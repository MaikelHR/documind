/* DocuMind - Vercel cron target (phase 5): one trivial Supabase query per day
   so the free-tier project never hits its ~7-idle-days auto-pause (which would
   otherwise need a manual restore in the dashboard). Scheduled by vercel.json:
   { "crons": [{ "path": "/api/keepalive", "schedule": "0 12 * * *" }] }.

   When CRON_SECRET is set, Vercel sends it as `Authorization: Bearer <secret>`
   on cron invocations and anything else gets a 401 - so random visitors can't
   use this as a free query button. Without the env var the probe is open
   (it reveals nothing and touches one row at most). */

/// <reference types="node" />
import { pingUserChunks, supabaseEnv } from './_supabase.js';

const UPSTREAM_TIMEOUT_MS = 10_000;

interface VercelReq {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}
interface VercelRes {
  status(code: number): VercelRes;
  json(data: unknown): void;
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers?.authorization;
    const header = Array.isArray(auth) ? auth[0] : auth;
    if (header !== `Bearer ${secret}`) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
  }

  if (!supabaseEnv()) {
    res.status(500).json({ error: 'missing_supabase_env' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    await pingUserChunks(controller.signal);
    res.status(200).json({ ok: true });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown_error';
    console.error('[api/keepalive] failed:', detail);
    res.status(502).json({ error: 'keepalive_failed', detail });
  } finally {
    clearTimeout(timer);
  }
}

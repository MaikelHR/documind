/* DocuMind - session document list (phase 5 follow-up): uploaded docs survive
   page reloads. On load the frontend rebuilds its sidebar from this endpoint
   (the backend is the source of truth, so expired uploads drop off naturally
   instead of lingering as ghosts in localStorage).

   GET    /api/docs?sessionId=...          -> { docs: [{ docId, name, ext, pages }] }
   DELETE /api/docs?sessionId=...&docId=...-> { ok: true }  (sidebar delete: the
                                              doc's stored chunks are removed)

   Node-style (req, res) handler; the Supabase key never leaves the server. */

/// <reference types="node" />
import { deleteUserDoc, listSessionDocs, supabaseEnv } from './_supabase.js';

const UPSTREAM_TIMEOUT_MS = 10_000;

interface VercelReq {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
}
interface VercelRes {
  status(code: number): VercelRes;
  json(data: unknown): void;
}

function qparam(req: VercelReq, key: string): string {
  const v = req.query?.[key];
  return ((Array.isArray(v) ? v[0] : v) ?? '').trim();
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const sessionId = qparam(req, 'sessionId');
  if (!sessionId) {
    res.status(400).json({ error: 'missing_params' });
    return;
  }
  if (!supabaseEnv()) {
    res.status(500).json({ error: 'missing_supabase_env' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    if (req.method === 'DELETE') {
      const docId = qparam(req, 'docId');
      if (!docId) {
        res.status(400).json({ error: 'missing_params' });
        return;
      }
      await deleteUserDoc(sessionId, docId, controller.signal);
      res.status(200).json({ ok: true });
      return;
    }

    const docs = await listSessionDocs(sessionId, controller.signal);
    res.status(200).json({ docs });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown_error';
    console.error('[api/docs] failed:', detail);
    res.status(502).json({ error: 'docs_failed', detail });
  } finally {
    clearTimeout(timer);
  }
}

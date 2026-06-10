/* DocuMind - Vercel serverless function: one page of an uploaded document
   (phase 5). The SourceDrawer renders fixed-corpus pages straight from
   shared/corpus.ts, but uploaded docs only exist in Supabase - this endpoint
   returns the stored chunks of (sessionId, docId, page) in order, which ARE
   that page's paragraphs (see api/ingest.ts), so a citation snippet is always
   an exact substring of one of them and the drawer highlight works unchanged.

   GET /api/page?sessionId=...&docId=...&page=N
   -> { docId, page, name, ext, pages, paras: string[] }

   Node-style (req, res) handler; the Supabase key never leaves the server. */

/// <reference types="node" />
import { pageChunks, supabaseEnv } from './_supabase.js';

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
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const sessionId = qparam(req, 'sessionId').trim();
  const docId = qparam(req, 'docId').trim();
  const page = Number(qparam(req, 'page'));
  if (!sessionId || !docId || !Number.isInteger(page) || page < 1) {
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
    const rows = await pageChunks(sessionId, docId, page, controller.signal);
    if (rows.length === 0) {
      res.status(404).json({ error: 'page_not_found' });
      return;
    }
    res.status(200).json({
      docId,
      page,
      name: rows[0].doc_name,
      ext: rows[0].ext,
      pages: rows[0].pages,
      paras: rows.map((r) => r.text),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown_error';
    console.error('[api/page] failed:', detail);
    res.status(502).json({ error: 'page_failed', detail });
  } finally {
    clearTimeout(timer);
  }
}

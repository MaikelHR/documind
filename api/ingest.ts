/* DocuMind - Vercel serverless function: real document upload (phase 5).

   Receives { sessionId, name, data } where `data` is a base64 PDF, extracts
   text per page (unpdf - serverless-friendly, no native deps), chunks each
   page into paragraphs (same criterion as shared/corpus.ts: one content
   paragraph = one citable chunk), embeds every chunk with the SAME model and
   parameters api/chat.ts uses for retrieval (gemini-embedding-001,
   RETRIEVAL_DOCUMENT, 768 dims) and batch-inserts the rows into Supabase
   pgvector (user_chunks). Uploaded docs are scoped to the visitor's sessionId
   and are ephemeral: every ingest also deletes chunks older than 7 days, so
   no cron or manual cleanup is needed.

   The chunks themselves ARE the paragraphs the drawer renders for uploaded
   pages (api/page.ts), so a citation snippet is always an exact substring of
   its rendered page - the same invariant the fixed corpus guarantees.

   Node-style (req, res) handler; Gemini and Supabase are called over REST
   with fetch + AbortController, keys live only on the server. */

/// <reference types="node" />
import { randomUUID } from 'node:crypto';
import { extractText, getDocumentProxy } from 'unpdf';
import { deleteExpiredChunks, insertUserChunks, supabaseEnv, type UserChunkRow } from './_supabase.js';

export const config = { maxDuration: 60 };

// MUST match EMBED_MODEL/EMBED_DIMS in api/chat.ts and scripts/embed-corpus.mjs.
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIMS = 768;
const BATCH_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`;
const EMBED_BATCH_SIZE = 100; // batchEmbedContents accepts up to 100 requests

// A Vercel function body tops out around 4.5 MB, so a 4 MB PDF is the most
// that can arrive base64-encoded. Hard caps below keep one upload from eating
// the whole 60s budget (and the free embedding quota).
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 100;
const MAX_CHUNKS = 300;

const UPSTREAM_TIMEOUT_MS = 50_000; // whole pipeline budget, under maxDuration
const MAX_ATTEMPTS = 3;

// Paragraph sizing: drop sub-40-char fragments (page numbers, headers) and
// split blocks larger than ~700 chars on sentence boundaries.
const MIN_PARA_CHARS = 40;
const MAX_PARA_CHARS = 700;

/* Rate limiting: uploads are far more expensive than questions (parse + N
   embeddings + storage), so the cap is low - 3 per IP per UTC day. Same
   best-effort in-memory pattern as api/chat.ts. */
const UPLOADS_PER_DAY = 3;
const ipUploads = new Map<string, number>();
let dailyDate = '';

function clientIp(req: VercelReq): string {
  const fwd = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  return (first ?? '').split(',')[0].trim() || 'unknown';
}

function admitUpload(ip: string, now: number): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== dailyDate) {
    dailyDate = today;
    ipUploads.clear();
  }
  const used = ipUploads.get(ip) ?? 0;
  if (used >= UPLOADS_PER_DAY) return false;
  ipUploads.set(ip, used + 1);
  return true;
}

/** Minimal shapes of Vercel's Node request/response (same as api/chat.ts). */
interface VercelReq {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
interface VercelRes {
  status(code: number): VercelRes;
  json(data: unknown): void;
}

function readBody(raw: unknown): { sessionId?: unknown; name?: unknown; data?: unknown; lang?: unknown } {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (raw ?? {}) as Record<string, unknown>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* Paragraph chunking - the corpus criterion: one content paragraph per chunk.
   Real PDFs rarely carry clean blank-line breaks, so blocks beyond
   MAX_PARA_CHARS are re-split on sentence boundaries. Whitespace is collapsed
   BEFORE storing, so the stored text is exactly what the drawer renders. */

const SENTENCE_SPLIT_RE = /(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡"“(\d])/;

function splitLongBlock(block: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const sentence of block.split(SENTENCE_SPLIT_RE)) {
    if (cur && cur.length + sentence.length + 1 > MAX_PARA_CHARS) {
      out.push(cur);
      cur = sentence;
    } else {
      cur = cur ? `${cur} ${sentence}` : sentence;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function pageToParagraphs(pageText: string): string[] {
  return pageText
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .flatMap((block) => (block.length > MAX_PARA_CHARS ? splitLongBlock(block) : [block]))
    .filter((p) => p.length >= MIN_PARA_CHARS && /[a-zA-Záéíóúüñ]/.test(p));
}

/* Language of the document decides which questions can retrieve it (the
   match_user_chunks RPC filters by lang, like the fixed corpus). A tiny
   stopword vote beats trusting the UI language: people upload English PDFs
   from the Spanish UI all the time. Ties fall back to the request lang. */
const ES_STOPWORDS = /\b(el|la|los|las|de|del|que|una|por|para|con|como|más|este|esta|son|sus)\b/gi;
const EN_STOPWORDS = /\b(the|of|and|to|in|is|for|that|with|this|are|from|was|which|been)\b/gi;

function detectLang(sample: string, fallback: 'es' | 'en'): 'es' | 'en' {
  const es = (sample.match(ES_STOPWORDS) ?? []).length;
  const en = (sample.match(EN_STOPWORDS) ?? []).length;
  if (es === en) return fallback;
  return es > en ? 'es' : 'en';
}

/** Embed all chunk texts (RETRIEVAL_DOCUMENT, 768 dims) in batches of 100,
    retrying the free tier's transient 503/429 like api/chat.ts does. */
async function embedChunks(texts: string[], apiKey: string, signal: AbortSignal): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const payload = JSON.stringify({
      requests: batch.map((text) => ({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: EMBED_DIMS,
      })),
    });
    const fire = () =>
      fetch(BATCH_EMBED_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: payload,
        signal,
      });
    let resp = await fire();
    for (let attempt = 1; attempt < MAX_ATTEMPTS && !resp.ok && (resp.status === 503 || resp.status === 429); attempt++) {
      await sleep(400 * attempt);
      resp = await fire();
    }
    if (!resp.ok) {
      throw new Error(`embed HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
    }
    const data = (await resp.json()) as { embeddings?: Array<{ values?: number[] }> };
    const got = (data.embeddings ?? []).map((e) => e.values ?? []);
    if (got.length !== batch.length || got.some((v) => v.length === 0)) {
      throw new Error('batchEmbedContents returned a mismatched embedding count');
    }
    vectors.push(...got);
  }
  return vectors;
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const b = readBody(req.body);
  const sessionId = typeof b.sessionId === 'string' ? b.sessionId.trim().slice(0, 80) : '';
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 160) : '';
  const data = typeof b.data === 'string' ? b.data : '';
  const reqLang = b.lang === 'en' ? 'en' : 'es';
  if (!sessionId || !name || !data) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }

  if (!admitUpload(clientIp(req), Date.now())) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'missing_api_key' });
    return;
  }
  if (!supabaseEnv()) {
    res.status(500).json({ error: 'missing_supabase_env' });
    return;
  }

  let pdf: Buffer;
  try {
    pdf = Buffer.from(data, 'base64');
  } catch {
    res.status(400).json({ error: 'bad_base64' });
    return;
  }
  if (pdf.byteLength > MAX_PDF_BYTES) {
    res.status(413).json({ error: 'file_too_large' });
    return;
  }
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    res.status(422).json({ error: 'not_pdf' });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    let pageTexts: string[];
    try {
      const proxy = await getDocumentProxy(new Uint8Array(pdf));
      const { text } = await extractText(proxy, { mergePages: false });
      pageTexts = text;
    } catch (err) {
      console.error('[api/ingest] pdf parse failed:', err instanceof Error ? err.message : err);
      res.status(422).json({ error: 'pdf_parse_failed' });
      return;
    }
    if (pageTexts.length > MAX_PAGES) {
      res.status(413).json({ error: 'too_many_pages', limit: MAX_PAGES });
      return;
    }

    const pages = pageTexts.length;
    const paras = pageTexts.flatMap((pageText, i) =>
      pageToParagraphs(pageText).map((text) => ({ page: i + 1, text })),
    );
    if (paras.length === 0) {
      // Typical for scanned/image-only PDFs - there is no text layer to index.
      res.status(422).json({ error: 'no_text' });
      return;
    }
    if (paras.length > MAX_CHUNKS) {
      res.status(413).json({ error: 'doc_too_large', limit: MAX_CHUNKS });
      return;
    }

    const lang = detectLang(paras.map((p) => p.text).join(' ').slice(0, 6000), reqLang);
    const vectors = await embedChunks(paras.map((p) => p.text), apiKey, controller.signal);

    // Ephemeral demo storage: sweep week-old uploads on every ingest
    // (best-effort - a failed sweep must not block this upload).
    try {
      await deleteExpiredChunks(controller.signal);
    } catch (err) {
      console.warn('[api/ingest] expired-chunk sweep failed:', err instanceof Error ? err.message : err);
    }

    const docId = `u-${randomUUID().slice(0, 8)}`;
    const ext = (name.split('.').pop() || 'pdf').toUpperCase().slice(0, 4);
    const rows: UserChunkRow[] = paras.map((p, i) => ({
      session_id: sessionId,
      doc_id: docId,
      doc_name: name,
      ext,
      pages,
      page: p.page,
      lang,
      text: p.text,
      embedding: vectors[i],
    }));
    await insertUserChunks(rows, controller.signal);

    res.status(200).json({ docId, name, pages, chunks: rows.length, lang });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const detail = aborted
      ? `upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : 'unknown_error';
    console.error('[api/ingest] failed:', detail);
    res.status(502).json({ error: aborted ? 'ingest_timeout' : 'ingest_failed', detail });
  } finally {
    clearTimeout(timer);
  }
}

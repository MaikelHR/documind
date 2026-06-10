/* DocuMind - server-side Supabase (PostgREST) helpers for the user-uploaded
   document store (phase 5). Plain fetch against the REST endpoints - no SDK,
   same spirit as the Gemini calls in api/chat.ts. The underscore prefix keeps
   Vercel from exposing this file as a function route.

   Auth: the configured SUPABASE_SERVICE_ROLE_KEY uses Supabase's NEW secret
   format (sb_secret_..., not a JWT), so it travels ONLY in the `apikey`
   header. Do NOT also send `Authorization: Bearer` - PostgREST expects a JWT
   there and would answer 401. The key lives only on the server. */

/// <reference types="node" />

/** A row of the user_chunks table (see the schema in BACKEND.md). */
export interface UserChunkRow {
  session_id: string;
  doc_id: string;
  doc_name: string;
  ext: string;
  pages: number;
  page: number;
  lang: string;
  text: string;
  embedding: number[];
}

/** A match returned by the match_user_chunks RPC (cosine score included). */
export interface UserMatch {
  doc_id: string;
  doc_name: string;
  pages: number;
  page: number;
  text: string;
  score: number;
}

export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

/** One PostgREST call. `path` starts with /rest/v1/...; throws on HTTP error. */
async function sbFetch(
  path: string,
  init: { method?: string; body?: string; prefer?: string; signal?: AbortSignal },
): Promise<Response> {
  const env = supabaseEnv();
  if (!env) throw new Error('supabase env missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  const headers: Record<string, string> = { apikey: env.key, 'content-type': 'application/json' };
  if (init.prefer) headers.Prefer = init.prefer;
  const resp = await fetch(env.url + path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body,
    signal: init.signal,
  });
  if (!resp.ok) {
    throw new Error(`supabase HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  return resp;
}

/** Batch-insert chunk rows (one POST, array body). */
export async function insertUserChunks(rows: UserChunkRow[], signal?: AbortSignal): Promise<void> {
  await sbFetch('/rest/v1/user_chunks', {
    method: 'POST',
    body: JSON.stringify(rows),
    prefer: 'return=minimal',
    signal,
  });
}

/** Same-session, same-language top-k by cosine similarity (match_user_chunks RPC). */
export async function matchUserChunks(
  queryEmbedding: number[],
  session: string,
  qlang: string,
  k: number,
  signal?: AbortSignal,
): Promise<UserMatch[]> {
  const resp = await sbFetch('/rest/v1/rpc/match_user_chunks', {
    method: 'POST',
    body: JSON.stringify({ query_embedding: queryEmbedding, session, qlang, k }),
    signal,
  });
  const data = (await resp.json()) as unknown;
  return Array.isArray(data) ? (data as UserMatch[]) : [];
}

/** All chunks of one uploaded page, in insert order - the drawer's paragraphs. */
export async function pageChunks(
  sessionId: string,
  docId: string,
  page: number,
  signal?: AbortSignal,
): Promise<Array<{ doc_name: string; ext: string; pages: number; text: string }>> {
  const q = new URLSearchParams({
    select: 'doc_name,ext,pages,text',
    session_id: `eq.${sessionId}`,
    doc_id: `eq.${docId}`,
    page: `eq.${page}`,
    order: 'id.asc',
  });
  const resp = await sbFetch(`/rest/v1/user_chunks?${q}`, { signal });
  const data = (await resp.json()) as unknown;
  return Array.isArray(data) ? (data as Array<{ doc_name: string; ext: string; pages: number; text: string }>) : [];
}

/** Distinct uploaded docs of one session, newest first, derived from its chunk
    rows - so expired (swept) docs drop off the list naturally. */
export async function listSessionDocs(
  sessionId: string,
  signal?: AbortSignal,
): Promise<Array<{ docId: string; name: string; ext: string; pages: number }>> {
  const q = new URLSearchParams({
    select: 'doc_id,doc_name,ext,pages',
    session_id: `eq.${sessionId}`,
    order: 'id.desc',
  });
  const resp = await sbFetch(`/rest/v1/user_chunks?${q}`, { signal });
  const rows = (await resp.json()) as unknown;
  const seen = new Map<string, { docId: string; name: string; ext: string; pages: number }>();
  for (const r of Array.isArray(rows) ? (rows as Array<{ doc_id: string; doc_name: string; ext: string; pages: number }>) : []) {
    if (!seen.has(r.doc_id)) seen.set(r.doc_id, { docId: r.doc_id, name: r.doc_name, ext: r.ext, pages: r.pages });
  }
  return [...seen.values()];
}

/** Drop all chunks of one uploaded doc (the sidebar's delete button). */
export async function deleteUserDoc(sessionId: string, docId: string, signal?: AbortSignal): Promise<void> {
  const q = new URLSearchParams({ session_id: `eq.${sessionId}`, doc_id: `eq.${docId}` });
  await sbFetch(`/rest/v1/user_chunks?${q}`, { method: 'DELETE', prefer: 'return=minimal', signal });
}

/** Demo uploads are ephemeral: drop anything older than 7 days. Called on each
    ingest (no cron needed); failures are logged, never fatal. */
export async function deleteExpiredChunks(signal?: AbortSignal): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await sbFetch(`/rest/v1/user_chunks?created_at=lt.${encodeURIComponent(cutoff)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
    signal,
  });
}

/** Trivial probe used by the keep-alive cron (counts as DB activity). */
export async function pingUserChunks(signal?: AbortSignal): Promise<void> {
  await sbFetch('/rest/v1/user_chunks?select=id&limit=1', { signal });
}

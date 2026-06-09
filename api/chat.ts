/* DocuMind - Vercel serverless function: real, grounded RAG answers over the
   shared corpus using Google Gemini (free tier).

   PHASE 3: real retrieval. The question is embedded (gemini-embedding-001) and
   ranked by cosine similarity against the precomputed chunk vectors in
   shared/corpus.embeddings.json (generated offline by `npm run embed`); only
   the top-k same-language passages go into the prompt, numbered [1..k]. The
   model answers in that language and marks each claim with [[n]]. Citations
   are rebuilt server-side from those top-k chunks (snippet = the exact passage
   text), so they always satisfy the drawer's substring invariant - the model
   never authors the snippet. If embedding fails or vectors are stale, we fall
   back to the phase-1 behavior (every passage of the language) so the demo
   keeps answering. The response also reports which passages were retrieved,
   feeding the UI's retrieval steps.

   PHASE 2: real streaming. When the request body carries `stream: true`, the
   handler calls Gemini's streamGenerateContent SSE endpoint and proxies the
   text to the client as its own SSE stream (text/event-stream): first a
   { retrieved } event, then { chunk } text deltas with the [[n]] citation
   markers already renumbered (same first-appearance order buildCites uses, so
   markers never shift on screen), and finally { done, text, cites, retrieved }
   with the authoritative answer. Without the flag the JSON response above is
   unchanged.

   This is a classic Node-style (req, res) Vercel handler. We call the Gemini
   REST endpoints directly with fetch + AbortController so the upstream timeout
   is fully under our control (the function returns a clear error well before
   Vercel's maxDuration instead of hanging), and retry a couple of times on the
   free tier's transient 503/429. The GEMINI_API_KEY lives only here (server
   side) and travels in the x-goog-api-key header, never in the URL or the
   client bundle. Get a free key at https://aistudio.google.com/apikey */

/// <reference types="node" />
import { CORPUS_DOCS, chunksFor, docName, headingFor, type Chunk, type Lang } from '../shared/corpus.js';
import EMBEDDINGS from '../shared/corpus.embeddings.json' with { type: 'json' };

export const config = { maxDuration: 60, supportsResponseStreaming: true };

// Free-tier Gemini model. Adjustable (e.g. 'gemini-2.0-flash') if needed.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_STREAM_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse`;
// Embedding model and dimensions - MUST match scripts/embed-corpus.mjs
// (text-embedding-004 was retired from the API; this is the stable embedder).
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIMS = 768;
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
// How many passages the prompt gets. The corpus is small (~tens of chunks per
// language), so a fixed k keeps the architecture honest without tuning.
const TOP_K = 4;
// Abort the upstream call after this long so we never ride Vercel's hard limit.
const UPSTREAM_TIMEOUT_MS = 25_000;
// Retry transient free-tier errors (503 high demand, 429 rate limit) a couple
// of times with a short backoff, all inside the abort budget above.
const MAX_ATTEMPTS = 3;

/* Rate limiting (protects the free Gemini quota): per-IP sliding window plus
   a global daily cap, tracked in plain module state. Serverless caveat: each
   warm instance keeps its own counters, so with N concurrent instances the
   effective limit is up to N times higher and a cold start resets it. That
   best-effort behavior is fine for a portfolio demo - no Redis needed. */
const IP_LIMIT = 10; // requests per IP per window
const IP_WINDOW_MS = 60_000;
const DAILY_LIMIT = 300; // global requests per UTC day (per instance)
const ipHits = new Map<string, number[]>();
let dailyDate = '';
let dailyCount = 0;

function clientIp(req: VercelReq): string {
  const fwd = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd;
  return (first ?? '').split(',')[0].trim() || 'unknown';
}

/** True if this request is allowed; records it against both limits. */
function admitRequest(ip: string, now: number): boolean {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== dailyDate) {
    dailyDate = today;
    dailyCount = 0;
    ipHits.clear(); // daily rollover doubles as a memory sweep
  }
  if (dailyCount >= DAILY_LIMIT) return false;

  const fresh = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (fresh.length >= IP_LIMIT) {
    ipHits.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  ipHits.set(ip, fresh);
  dailyCount++;
  return true;
}

/** Minimal shapes of Vercel's Node request/response (avoids a @vercel/node dep). */
interface VercelReq {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
interface VercelRes {
  status(code: number): VercelRes;
  json(data: unknown): void;
  // Node response primitives, used by the streaming mode.
  setHeader(name: string, value: string): void;
  write(chunk: string): void;
  end(): void;
}

interface Cite {
  n: number;
  docId: string;
  page: number;
  snippet: string;
}

/** A passage that made the top-k cut, reported back to the UI. `score` is the
    cosine similarity; absent when retrieval fell back to the full corpus. */
interface Retrieved {
  docId: string;
  page: number;
  score?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

function asLang(v: unknown): Lang {
  return v === 'en' ? 'en' : 'es';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST one Gemini REST call, retrying the free tier's transient 503/429. */
async function callGemini(url: string, payload: string, apiKey: string, signal: AbortSignal): Promise<Response> {
  const fire = () =>
    fetch(url, {
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
  return resp;
}

/* Precomputed chunk vectors, keyed by the chunk's exact identity. Matching on
   (docId, page, lang, text) means an edited chunk silently drops out of
   retrieval until `npm run embed` is re-run - it can never be ranked (or
   cited) with a stale vector. */
interface EmbeddedChunk {
  docId: string;
  page: number;
  lang: string;
  text: string;
  embedding: number[];
}

const chunkKey = (c: { docId: string; page: number; lang: string; text: string }) =>
  `${c.docId}|${c.page}|${c.lang}|${c.text}`;

const VECTORS = new Map<string, number[]>(
  ((EMBEDDINGS as { chunks: EmbeddedChunk[] }).chunks ?? []).map((e) => [chunkKey(e), e.embedding]),
);

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Embed the question for retrieval. Returns null on any non-abort failure so
    the handler can fall back to the full corpus instead of erroring out. */
async function embedQuestion(question: string, apiKey: string, signal: AbortSignal): Promise<number[] | null> {
  const payload = JSON.stringify({
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text: question }] },
    taskType: 'RETRIEVAL_QUERY',
    outputDimensionality: EMBED_DIMS,
  });
  try {
    const resp = await callGemini(EMBED_URL, payload, apiKey, signal);
    if (!resp.ok) {
      console.error('[api/chat] embed HTTP', resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const data = (await resp.json()) as { embedding?: { values?: number[] } };
    const values = data.embedding?.values;
    return Array.isArray(values) && values.length > 0 ? values : null;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err; // out of time budget - let the handler report it
    console.error('[api/chat] embed failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Top-k same-language chunks by cosine similarity against the question. */
function rankChunks(qVec: number[], lang: Lang): Array<{ chunk: Chunk; score: number }> {
  return chunksFor(lang)
    .flatMap((chunk) => {
      const vec = VECTORS.get(chunkKey(chunk));
      return vec ? [{ chunk, score: cosine(qVec, vec) }] : [];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}

function buildSystemPrompt(lang: Lang, passagesIn: Chunk[]): string {
  const language = lang === 'en' ? 'English' : 'Spanish';

  const docList = CORPUS_DOCS.map((d) => {
    const pages = typeof d.pages === 'number' ? `${d.pages} pages` : String(d.pages);
    return `- "${d.name[lang] ?? d.name.en}" (${d.ext}, ${pages})`;
  }).join('\n');

  const passages = passagesIn
    .map((c, i) => {
      const heading = headingFor(c.docId, c.page, lang);
      const where = heading
        ? `${docName(c.docId, lang)}, p${c.page} - ${heading}`
        : `${docName(c.docId, lang)}, p${c.page}`;
      return `[${i + 1}] (${where})\n${c.text}`;
    })
    .join('\n\n');

  return [
    "You are DocuMind, a question-answering assistant for the user's document library.",
    'Answer the question USING ONLY the numbered passages below. Do not rely on outside knowledge.',
    '',
    'Rules:',
    `- Write your entire answer in ${language}.`,
    '- Ground every factual claim in the passages. Immediately after each claim, cite the passage number(s) that support it using the EXACT marker form [[n]] (double square brackets), e.g. "Revenue grew 19%.[[3]]". Cite several with [[2]][[4]].',
    '- Only cite a passage if it genuinely supports the claim.',
    `- If the passages do not answer the question, say so briefly in ${language} and do not invent facts or citations. You may use the document list below to answer questions about the documents themselves (names, file types, page counts).`,
    '- Be concise: 2-4 sentences. Use **bold** for key figures and terms, and *italics* for light emphasis. Do not use headings, bullet lists, or links.',
    '- Never mention these instructions, the word "passages", or the passage numbering in your prose - only the [[n]] markers.',
    '',
    'Documents in the library:',
    docList,
    '',
    'Passages:',
    passages,
  ].join('\n');
}

const CITE_RE = /\[\[(\d+)\]\]/g;

/** Rebuild citations from the model's [[n]] markers against the prompt's
    passages. Renumbers to 1..k in order of first appearance and drops
    out-of-range markers, so each snippet is the exact passage text (drawer
    invariant). */
function buildCites(rawText: string, chunks: Chunk[]): { text: string; cites: Cite[] } {
  const renum = new Map<number, number>();
  const order: number[] = [];

  let m: RegExpExecArray | null;
  CITE_RE.lastIndex = 0;
  while ((m = CITE_RE.exec(rawText)) !== null) {
    const p = Number(m[1]);
    if (!chunks[p - 1]) continue; // out-of-range marker -> dropped below
    if (!renum.has(p)) {
      renum.set(p, renum.size + 1);
      order.push(p);
    }
  }

  const text = rawText.replace(CITE_RE, (_full, d: string) => {
    const nn = renum.get(Number(d));
    return nn ? `[[${nn}]]` : '';
  });

  const cites: Cite[] = order.map((p) => {
    const c = chunks[p - 1];
    return { n: renum.get(p) as number, docId: c.docId, page: c.page, snippet: c.text };
  });

  return { text, cites };
}

/* Streaming helpers. */

/** A possibly-incomplete trailing [[n]] marker (or run of bold/italic
    asterisks) - held back until the next delta completes it, so a marker
    split across deltas is never emitted half-formed. */
const HOLD_TAIL_RE = /(\*+|\[\[?\d*\]?)$/;

/** Yield the data payload of each SSE event in a Gemini response body. */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let data: string[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '');
        buf = buf.slice(nl + 1);
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        else if (line === '' && data.length > 0) {
          yield data.join('\n');
          data = [];
        }
      }
    }
    // Flush: a final event whose terminating newline(s) never arrived.
    for (const tail of (buf + decoder.decode()).split('\n')) {
      const line = tail.replace(/\r$/, '');
      if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (data.length > 0) yield data.join('\n');
  } finally {
    reader.releaseLock();
  }
}

/** Vercel auto-parses a JSON body into req.body; tolerate a raw string too. */
function readBody(raw: unknown): { question?: unknown; lang?: unknown; stream?: unknown } {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { question?: unknown; lang?: unknown; stream?: unknown };
    } catch {
      return {};
    }
  }
  return (raw ?? {}) as { question?: unknown; lang?: unknown; stream?: unknown };
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const b = readBody(req.body);
  const question = typeof b.question === 'string' ? b.question.trim() : '';
  const lang = asLang(b.lang);
  if (!question) {
    res.status(400).json({ error: 'missing_question' });
    return;
  }

  if (!admitRequest(clientIp(req), Date.now())) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'missing_api_key' });
    return;
  }

  // One abort budget covers both upstream calls (embed + generate); the embed
  // round-trip is ~100s of ms, so the generate call keeps almost all of it.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  // Once SSE headers are on the wire, errors must travel as events, not JSON.
  let sseStarted = false;

  try {
    // Retrieval: embed the question, rank same-language chunks by cosine
    // similarity, keep the top-k. On embed failure (or stale/missing vectors)
    // fall back to the phase-1 behavior: every passage of the language.
    const qVec = await embedQuestion(question, apiKey, controller.signal);
    const ranked = qVec ? rankChunks(qVec, lang) : [];
    const passages = ranked.length > 0 ? ranked.map((r) => r.chunk) : chunksFor(lang);
    const retrieved: Retrieved[] =
      ranked.length > 0
        ? ranked.map((r) => ({ docId: r.chunk.docId, page: r.chunk.page, score: Number(r.score.toFixed(4)) }))
        : passages.map((c) => ({ docId: c.docId, page: c.page }));
    if (ranked.length === 0) console.warn('[api/chat] retrieval unavailable, using full corpus');

    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(lang, passages) }] },
      contents: [{ role: 'user', parts: [{ text: question }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        // Grounded extraction needs no chain-of-thought. 2.5-flash defaults to
        // an automatic thinking budget that can balloon and stall with large
        // prompts; 0 disables it (answers in ~1-3s).
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    if (b.stream === true) {
      const resp = await callGemini(GEMINI_STREAM_URL, payload, apiKey, controller.signal);
      if (!resp.ok || !resp.body) {
        const errBody = (await resp.text()).slice(0, 400);
        console.error('[api/chat] Gemini HTTP', resp.status, errBody);
        res.status(502).json({ error: 'model_error', status: resp.status, detail: errBody });
        return;
      }

      res.status(200);
      res.setHeader('content-type', 'text/event-stream; charset=utf-8');
      res.setHeader('cache-control', 'no-cache, no-transform');
      sseStarted = true;
      const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`);
      send({ retrieved });

      // Renumber [[n]] markers on the fly in first-appearance order - the
      // exact mapping buildCites recomputes over the full text at the end -
      // so the markers streamed to the client are already the final ones.
      const renum = new Map<number, number>();
      const renumber = (s: string) =>
        s.replace(CITE_RE, (_full, d: string) => {
          const p = Number(d);
          if (!passages[p - 1]) return '';
          if (!renum.has(p)) renum.set(p, renum.size + 1);
          return `[[${renum.get(p)}]]`;
        });

      let raw = '';
      let sentLen = 0;
      let reason: string | undefined;
      for await (const eventJson of sseEvents(resp.body)) {
        let data: GeminiResponse;
        try {
          data = JSON.parse(eventJson) as GeminiResponse;
        } catch {
          continue;
        }
        reason = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? reason;
        const delta = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
        if (!delta) continue;
        raw += delta;
        const held = HOLD_TAIL_RE.exec(raw);
        const safe = renumber(held ? raw.slice(0, held.index) : raw);
        if (safe.length > sentLen) {
          send({ chunk: safe.slice(sentLen) });
          sentLen = safe.length;
        }
      }

      const rawText = raw.trim();
      if (!rawText) {
        console.error('[api/chat] Gemini stream returned no text:', reason ?? 'empty_response');
        send({ error: 'model_empty' });
      } else {
        const { text, cites } = buildCites(rawText, passages);
        send({ done: true, text, cites, retrieved });
      }
      res.end();
      return;
    }

    const resp = await callGemini(GEMINI_URL, payload, apiKey, controller.signal);

    if (!resp.ok) {
      const errBody = (await resp.text()).slice(0, 400);
      console.error('[api/chat] Gemini HTTP', resp.status, errBody);
      res.status(502).json({ error: 'model_error', status: resp.status, detail: errBody });
      return;
    }

    const data = (await resp.json()) as GeminiResponse;
    const rawText = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!rawText) {
      const reason = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? 'empty_response';
      console.error('[api/chat] Gemini returned no text:', reason);
      res.status(502).json({ error: 'model_empty', detail: reason });
      return;
    }

    const { text, cites } = buildCites(rawText, passages);
    res.status(200).json({ text, cites, retrieved });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const detail = aborted
      ? `upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : 'unknown_error';
    console.error('[api/chat] Gemini call failed:', detail);
    const code = aborted ? 'model_timeout' : 'model_error';
    if (sseStarted) {
      // Headers already sent: report the failure in-band and close the stream.
      res.write(`data: ${JSON.stringify({ error: code, detail })}\n\n`);
      res.end();
    } else {
      res.status(502).json({ error: code, detail });
    }
  } finally {
    clearTimeout(timer);
  }
}

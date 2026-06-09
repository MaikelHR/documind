/* DocuMind - Vercel serverless function: real, grounded RAG answers over the
   shared corpus using Google Gemini (free tier).

   PHASE 1: no streaming, no retrieval. Every passage of the requested language
   is placed in the prompt, numbered [1..N]; the model answers in that language
   and marks each claim with [[n]]. Citations are rebuilt server-side from the
   corpus (snippet = the exact passage text), so they always satisfy the
   drawer's substring invariant - the model never authors the snippet.

   This is a classic Node-style (req, res) Vercel handler. We call the Gemini
   REST endpoint directly with fetch + AbortController so the upstream timeout
   is fully under our control (the function returns a clear error well before
   Vercel's maxDuration instead of hanging), and retry a couple of times on the
   free tier's transient 503/429. The GEMINI_API_KEY lives only here (server
   side) and travels in the x-goog-api-key header, never in the URL or the
   client bundle. Get a free key at https://aistudio.google.com/apikey */

/// <reference types="node" />
import { CORPUS_DOCS, chunksFor, docName, headingFor, type Lang } from '../shared/corpus.js';

export const config = { maxDuration: 60 };

// Free-tier Gemini model. Adjustable (e.g. 'gemini-2.0-flash') if needed.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
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
}

interface Cite {
  n: number;
  docId: string;
  page: number;
  snippet: string;
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

function buildSystemPrompt(lang: Lang): string {
  const language = lang === 'en' ? 'English' : 'Spanish';

  const docList = CORPUS_DOCS.map((d) => {
    const pages = typeof d.pages === 'number' ? `${d.pages} pages` : String(d.pages);
    return `- "${d.name[lang] ?? d.name.en}" (${d.ext}, ${pages})`;
  }).join('\n');

  const passages = chunksFor(lang)
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
    '- Ground every factual claim in the passages. Immediately after each claim, cite the passage number(s) that support it using the EXACT marker form [[n]] (double square brackets), e.g. "Revenue grew 19%.[[3]]". Cite several with [[2]][[5]].',
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

/** Rebuild citations from the model's [[n]] markers against the corpus.
    Renumbers to 1..k in order of first appearance and drops out-of-range
    markers, so each snippet is the exact passage text (drawer invariant). */
function buildCites(rawText: string, lang: Lang): { text: string; cites: Cite[] } {
  const chunks = chunksFor(lang);
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

/** Vercel auto-parses a JSON body into req.body; tolerate a raw string too. */
function readBody(raw: unknown): { question?: unknown; lang?: unknown } {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as { question?: unknown; lang?: unknown };
    } catch {
      return {};
    }
  }
  return (raw ?? {}) as { question?: unknown; lang?: unknown };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      // Grounded extraction needs no chain-of-thought. 2.5-flash defaults to an
      // automatic thinking budget that, with the whole corpus in the prompt,
      // can balloon and stall; 0 disables it (answers in ~1-3s).
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  try {
    const fire = () =>
      fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: payload,
        signal: controller.signal,
      });

    let resp = await fire();
    for (let attempt = 1; attempt < MAX_ATTEMPTS && !resp.ok && (resp.status === 503 || resp.status === 429); attempt++) {
      await sleep(400 * attempt);
      resp = await fire();
    }

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

    const { text, cites } = buildCites(rawText, lang);
    res.status(200).json({ text, cites });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const detail = aborted
      ? `upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : 'unknown_error';
    console.error('[api/chat] Gemini call failed:', detail);
    res.status(502).json({ error: aborted ? 'model_timeout' : 'model_error', detail });
  } finally {
    clearTimeout(timer);
  }
}

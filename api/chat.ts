/* DocuMind - Vercel serverless function: real, grounded RAG answers over the
   shared corpus using Google Gemini (free tier).

   PHASE 1: no streaming, no retrieval. Every passage of the requested language
   is placed in the prompt, numbered [1..N]; the model answers in that language
   and marks each claim with [[n]]. Citations are rebuilt server-side from the
   corpus (snippet = the exact passage text), so they always satisfy the
   drawer's substring invariant - the model never authors the snippet.

   We call the Gemini REST endpoint directly with fetch + AbortController so the
   request timeout is fully under our control (the function returns a clear
   error well before Vercel's maxDuration instead of hanging). The
   GEMINI_API_KEY lives only here (server side) and travels in the
   x-goog-api-key header, never in the URL or the client bundle. Get a free key
   at https://aistudio.google.com/apikey */

/// <reference types="node" />
import { CORPUS_DOCS, chunksFor, docName, headingFor, type Lang } from '../shared/corpus.js';

export const config = { maxDuration: 60 };

// Free-tier Gemini model. Adjustable (e.g. 'gemini-2.0-flash') if needed.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// Abort the upstream call after this long so we never ride Vercel's hard limit.
const UPSTREAM_TIMEOUT_MS = 25_000;

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const b = (body ?? {}) as { question?: unknown; lang?: unknown };
  const question = typeof b.question === 'string' ? b.question.trim() : '';
  const lang = asLang(b.lang);
  if (!question) return json({ error: 'missing_question' }, 400);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'missing_api_key' }, 500);

  // --- TEMPORARY diagnostics (remove before merge to main) ---
  if (question === '__diag__') {
    return json({ marker: 'rest-diag-v2', hasKey: !!apiKey, keyLen: apiKey.length, node: process.version, model: GEMINI_MODEL });
  }
  if (question === '__pinggemini__') {
    const c = new AbortController();
    const tm = setTimeout(() => c.abort(), 8000);
    const t0 = Date.now();
    try {
      const r = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with the single word OK.' }] }],
          generationConfig: { maxOutputTokens: 16, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: c.signal,
      });
      const bodyStart = (await r.text()).slice(0, 300);
      return json({ pinged: true, status: r.status, ms: Date.now() - t0, bodyStart });
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return json({ pinged: false, aborted, ms: Date.now() - t0, detail: e instanceof Error ? e.message : String(e) });
    } finally {
      clearTimeout(tm);
    }
  }
  // --- end diagnostics ---

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const resp = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(lang) }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          // Grounded extraction needs no chain-of-thought. 2.5-flash defaults to
          // an automatic thinking budget that, with the whole corpus in the
          // prompt, can balloon and stall; 0 disables it (answers in ~1-3s).
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errBody = (await resp.text()).slice(0, 400);
      console.error('[api/chat] Gemini HTTP', resp.status, errBody);
      return json({ error: 'model_error', status: resp.status, detail: errBody }, 502);
    }

    const data = (await resp.json()) as GeminiResponse;
    const raw = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();

    if (!raw) {
      const reason = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? 'empty_response';
      console.error('[api/chat] Gemini returned no text:', reason);
      return json({ error: 'model_empty', detail: reason }, 502);
    }

    const { text, cites } = buildCites(raw, lang);
    return json({ text, cites });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const detail = aborted
      ? `upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms`
      : err instanceof Error
        ? err.message
        : 'unknown_error';
    console.error('[api/chat] Gemini call failed:', detail);
    return json({ error: aborted ? 'model_timeout' : 'model_error', detail }, 502);
  } finally {
    clearTimeout(timer);
  }
}

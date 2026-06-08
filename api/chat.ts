/* DocuMind - Vercel serverless function: real, grounded RAG answers over the
   shared corpus using Claude Sonnet.

   PHASE 1: no streaming, no retrieval. Every passage of the requested language
   is placed in the prompt, numbered [1..N]; the model answers in that language
   and marks each claim with [[n]]. Citations are rebuilt server-side from the
   corpus (snippet = the exact passage text), so they always satisfy the
   drawer's substring invariant - the model never authors the snippet.

   The ANTHROPIC_API_KEY lives only here (server side); it never reaches the
   client bundle. */

import Anthropic from '@anthropic-ai/sdk';
import { CORPUS_DOCS, chunksFor, docName, headingFor, type Lang } from '../shared/corpus';

export const config = { maxDuration: 60 };

interface Cite {
  n: number;
  docId: string;
  page: number;
  snippet: string;
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'missing_api_key' }, 500);
  }

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(lang),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: question }],
    });

    let raw = '';
    for (const block of message.content) {
      if (block.type === 'text') raw += block.text;
    }

    const { text, cites } = buildCites(raw.trim(), lang);
    return json({ text, cites });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown_error';
    return json({ error: 'model_error', detail }, 502);
  }
}

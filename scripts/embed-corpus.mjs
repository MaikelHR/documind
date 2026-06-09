/* DocuMind - offline corpus embedder (phase 3). Run ONCE locally whenever the
   corpus text changes: `npm run embed` (needs GEMINI_API_KEY in .env.local).

   For every chunk in shared/corpus.ts it calls the Gemini REST embedContent
   endpoint (key in the x-goog-api-key header, same rule as api/chat.ts: never
   in the URL) and writes the vectors to
   shared/corpus.embeddings.json next to docId/page/lang/text. That JSON is
   committed and imported by api/chat.ts, which matches each vector back to its
   chunk by exact (docId, page, lang, text) - so a corpus edit without re-running
   this script just drops that chunk from retrieval instead of mis-citing.

   The corpus is TypeScript (and imports `./sample.js` that is really a .ts
   file, nodenext style), so plain `node` can't load it; we borrow Vite's SSR
   module loader (already a dev dependency) to read it. */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'shared', 'corpus.embeddings.json');

// text-embedding-004 was retired from the API (404 as of 2026); this is the
// stable free-tier embedder. MUST match EMBED_MODEL/EMBED_DIMS in api/chat.ts.
const EMBED_MODEL = 'gemini-embedding-001';
const EMBED_DIMS = 768; // truncated output - plenty for 28 chunks, keeps the JSON small
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;
const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

/** GEMINI_API_KEY from the environment or .env.local (no dotenv dependency). */
function readApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const env = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
    const m = env.match(/^\s*GEMINI_API_KEY\s*=\s*"?([^"\r\n]+)"?\s*$/m);
    if (m) return m[1].trim();
  } catch {
    /* no .env.local - fall through to the error below */
  }
  console.error('GEMINI_API_KEY not found. Put it in .env.local (see .env.example).');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Embed one chunk text; retries the free tier's transient 503/429. */
async function embed(text, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const payload = JSON.stringify({
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text }] },
    taskType: 'RETRIEVAL_DOCUMENT',
    outputDimensionality: EMBED_DIMS,
  });
  try {
    const fire = () =>
      fetch(EMBED_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: payload,
        signal: controller.signal,
      });
    let resp = await fire();
    for (let attempt = 1; attempt < MAX_ATTEMPTS && !resp.ok && (resp.status === 503 || resp.status === 429); attempt++) {
      await sleep(600 * attempt);
      resp = await fire();
    }
    if (!resp.ok) {
      throw new Error(`Gemini HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    }
    const data = await resp.json();
    const values = data?.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('embedContent returned no embedding.values');
    }
    // 6 decimals keep cosine ranking intact and roughly halve the JSON size.
    return values.map((v) => Number(v.toFixed(6)));
  } finally {
    clearTimeout(timer);
  }
}

async function loadCorpus() {
  const server = await createServer({
    root: ROOT,
    configFile: false, // skip vite.config.ts (react plugin etc.) - not needed for plain TS
    logLevel: 'error',
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const mod = await server.ssrLoadModule('/shared/corpus.ts');
    return mod.CORPUS;
  } finally {
    await server.close();
  }
}

const apiKey = readApiKey();
const corpus = await loadCorpus();
console.log(`Embedding ${corpus.length} chunks with ${EMBED_MODEL}...`);

const chunks = [];
for (const [i, c] of corpus.entries()) {
  const embedding = await embed(c.text, apiKey);
  chunks.push({ docId: c.docId, page: c.page, lang: c.lang, text: c.text, embedding });
  console.log(`  [${i + 1}/${corpus.length}] ${c.docId} p${c.page} ${c.lang} (${embedding.length} dims)`);
}

const out = {
  model: EMBED_MODEL,
  dims: chunks[0].embedding.length,
  generatedAt: new Date().toISOString(),
  chunks,
};
writeFileSync(OUT_FILE, JSON.stringify(out));
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${chunks.length} vectors).`);

/* DocuMind - shared corpus: the single source of truth for retrievable text.
   Chunks { docId, page, lang, text } are derived EXACTLY from DOCS in
   src/data/sample.ts (same strings), so the backend (api/chat.ts) and the
   frontend drawer cite/highlight from one place and never drift.

   A chunk's `text` is one content paragraph, copied verbatim from its page, so
   it is always an exact substring of that page - the drawer highlights it with
   indexOf. Section headings (the first entry of each page) are NOT chunks: they
   provide context in the prompt but are not citable passages. */

import { DOCS } from '../src/data/sample.js';
import type { Bilingual, Doc, Lang, PageContent } from '../src/types.js';

export type { Lang };

export interface Chunk {
  docId: string;
  page: number;
  lang: Lang;
  text: string;
}

export interface CorpusDoc {
  docId: string;
  name: Bilingual<string>;
  ext: string;
  pages: number | string;
  kind: string;
}

const LANGS: Lang[] = ['es', 'en'];

function isBilingualContent(c: Doc['content']): c is Bilingual<PageContent> {
  return c != null && typeof c === 'object' && !Array.isArray(c) && ('es' in c || 'en' in c);
}

function pageContentFor(doc: Doc, lang: Lang): PageContent {
  const c = doc.content;
  if (isBilingualContent(c)) return (c[lang] ?? c.en ?? {}) as PageContent;
  return (c ?? {}) as PageContent;
}

function nameOf(doc: Doc): Bilingual<string> {
  return typeof doc.name === 'string' ? { es: doc.name, en: doc.name } : doc.name;
}

export const CORPUS_DOCS: CorpusDoc[] = DOCS.map((d) => ({
  docId: d.id,
  name: nameOf(d),
  ext: d.ext,
  pages: d.pages,
  kind: d.kind,
}));

function buildCorpus(): Chunk[] {
  const out: Chunk[] = [];
  for (const doc of DOCS) {
    for (const lang of LANGS) {
      const pc = pageContentFor(doc, lang);
      const pages = Object.keys(pc)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      for (const page of pages) {
        const paras = pc[page] ?? [];
        // paras[0] is the section heading; paras[1..] are citable content.
        for (let i = 1; i < paras.length; i++) {
          const text = paras[i];
          if (text && text.trim()) out.push({ docId: doc.id, page, lang, text });
        }
      }
    }
  }
  return out;
}

export const CORPUS: Chunk[] = buildCorpus();

export function chunksFor(lang: Lang): Chunk[] {
  return CORPUS.filter((c) => c.lang === lang);
}

export function docMeta(docId: string): CorpusDoc | undefined {
  return CORPUS_DOCS.find((d) => d.docId === docId);
}

export function docName(docId: string, lang: Lang): string {
  const d = docMeta(docId);
  return d ? d.name[lang] ?? d.name.en : docId;
}

/** All paragraphs of a page (heading first), for the drawer to render. */
export function pageParagraphs(docId: string, page: number, lang: Lang): string[] {
  const doc = DOCS.find((d) => d.id === docId);
  return doc ? pageContentFor(doc, lang)[page] ?? [] : [];
}

/** The section heading (first entry) of a page, used for prompt context. */
export function headingFor(docId: string, page: number, lang: Lang): string {
  return pageParagraphs(docId, page, lang)[0] ?? '';
}

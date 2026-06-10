/* DocuMind - shared domain types */

export type Direction = 'slate' | 'verdigris' | 'ember' | 'cobalt';
export type Mode = 'dark' | 'light';
export type Lang = 'es' | 'en';

/** A value that exists in both languages. Resolved to one via `pick()`. */
export interface Bilingual<T = string> {
  es: T;
  en: T;
}

/** A document page: index `page -> [section title, ...paragraphs]`. */
export type PageContent = Record<number, string[]>;

/** Per-language page content, or `{}` for freshly uploaded (un-parsed) docs. */
export type DocContent = Bilingual<PageContent> | PageContent;

export interface Doc {
  id: string;
  name: string | Bilingual<string>;
  ext: string;
  /** Number of pages, or a label like `'Note'` for markdown notes. */
  pages: number | string;
  kind: string; // 'pdf' | 'md' | ...
  indexed: boolean;
  indexing?: boolean;
  progress?: number;
  /** Localized message when a real upload was rejected (shown briefly). */
  error?: string;
  content: DocContent;
}

/** Citation as authored in the sample data (snippet is bilingual). */
export interface RawCite {
  n: number;
  docId: string;
  page: number;
  snippet: Bilingual<string>;
}

/** Citation resolved into the active language (snippet is a plain string). */
export interface Cite {
  n: number;
  docId: string;
  page: number | string;
  snippet: string;
  /** Set by the backend only for user-uploaded docs, which the local corpus
      can't resolve: display name, extension and page count for the UI. */
  docName?: string;
  ext?: string;
  pages?: number;
}

/** A passage the backend actually retrieved (top-k) for an answer; drives the
    live retrieval steps. `score` is the cosine similarity (when available). */
export interface Retrieved {
  docId: string;
  page: number;
  score?: number;
  /** Display name for user-uploaded docs (unknown to the local corpus). */
  docName?: string;
}

/** A streaming unit: a word/whitespace token, or an atomic citation marker. */
export type TextUnit = { text: string; bold?: boolean; ital?: boolean };
export type CiteUnit = { cite: number };
export type Unit = TextUnit | CiteUnit;

export type Phase = 'thinking' | 'streaming' | 'done';

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  time: string;
}

export interface AiMessage {
  id: string;
  role: 'ai';
  phase: Phase;
  text: string;
  cites: Cite[];
  /** Set when the real backend reports its top-k; undefined while retrieving
      (and for seeded/simulated answers). */
  retrieved?: Retrieved[];
  units: Unit[];
  revealed: number;
  time: string;
}

export type Message = UserMessage | AiMessage;

/** A saved conversation in the sidebar history (persisted to localStorage).
    Created on the first question the user sends in a chat. */
export interface ChatEntry {
  id: string;
  /** The first question, truncated - the list label. */
  title: string;
  createdAt: number;
  messages: Message[];
}

/* DocuMind - frontend client for the chat backend (api/chat.ts).
   Posts { question, lang } and returns the grounded answer + citations.
   On any failure the caller falls back to the simulated answer bank, so the
   UI still works under plain `vite dev` (no /api route) or if the API errors. */

import type { Cite, Lang, Retrieved } from '../types';

export interface ChatResponse {
  text: string;
  cites: Cite[];
  /** Top-k passages the backend actually retrieved (absent on older payloads). */
  retrieved?: Retrieved[];
}

/** HTTP 429 from the backend's rate limit - the UI shows a "demo exhausted"
    notice instead of silently falling back to the simulated answers. */
export class RateLimitedError extends Error {
  constructor() {
    super('rate_limited');
    this.name = 'RateLimitedError';
  }
}

export async function requestAnswer(question: string, lang: Lang, signal?: AbortSignal): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, lang }),
    signal,
  });
  if (res.status === 429) throw new RateLimitedError();
  if (!res.ok) throw new Error(`chat request failed: ${res.status}`);
  const data: unknown = await res.json();
  const d = (data ?? {}) as { text?: unknown; cites?: unknown; retrieved?: unknown };
  if (typeof d.text !== 'string' || !Array.isArray(d.cites)) {
    throw new Error('malformed chat response');
  }
  const retrieved = Array.isArray(d.retrieved) ? (d.retrieved as Retrieved[]) : undefined;
  return { text: d.text, cites: d.cites as Cite[], retrieved };
}

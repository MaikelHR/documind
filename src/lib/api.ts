/* DocuMind - frontend client for the chat backend (api/chat.ts).
   Posts { question, lang, stream: true } and consumes the SSE stream the
   backend proxies from Gemini: a { retrieved } event first, then { chunk }
   text deltas (citation markers already final), and a closing { done, text,
   cites, retrieved } event with the authoritative answer. A plain JSON
   response (no-stream backend) resolves to the same shape. On any failure
   the caller falls back to the simulated answer bank, so the UI still works
   under plain `vite dev` (no /api route) or if the API errors. */

import type { Cite, Lang, Retrieved } from '../types';

export interface ChatResponse {
  text: string;
  cites: Cite[];
  /** Top-k passages the backend actually retrieved (absent on older payloads). */
  retrieved?: Retrieved[];
}

/** Live progress while the answer streams in. */
export interface StreamCallbacks {
  /** The backend's top-k passages - arrives before the first text chunk. */
  onRetrieved?: (retrieved: Retrieved[]) => void;
  /** A delta of answer text as Gemini generates it. */
  onChunk?: (delta: string) => void;
}

/** HTTP 429 from the backend's rate limit - the UI shows a "demo exhausted"
    notice instead of silently falling back to the simulated answers. */
export class RateLimitedError extends Error {
  constructor() {
    super('rate_limited');
    this.name = 'RateLimitedError';
  }
}

/** One `data:` event of the backend's SSE protocol (fields are optional and
    validated field-by-field; unknown events are ignored). */
interface StreamEvent {
  retrieved?: unknown;
  chunk?: unknown;
  error?: unknown;
  done?: unknown;
  text?: unknown;
  cites?: unknown;
}

function parseJsonResponse(data: unknown): ChatResponse {
  const d = (data ?? {}) as { text?: unknown; cites?: unknown; retrieved?: unknown };
  if (typeof d.text !== 'string' || !Array.isArray(d.cites)) {
    throw new Error('malformed chat response');
  }
  const retrieved = Array.isArray(d.retrieved) ? (d.retrieved as Retrieved[]) : undefined;
  return { text: d.text, cites: d.cites as Cite[], retrieved };
}

export async function requestAnswer(
  question: string,
  lang: Lang,
  cb: StreamCallbacks = {},
  signal?: AbortSignal,
): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question, lang, stream: true }),
    signal,
  });
  if (res.status === 429) throw new RateLimitedError();
  if (!res.ok) throw new Error(`chat request failed: ${res.status}`);

  // A backend without streaming answers with plain JSON; resolve it as before.
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream') || !res.body) {
    return parseJsonResponse(await res.json());
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let dataLines: string[] = [];
  let acc = '';
  let retrieved: Retrieved[] | undefined;
  let final: ChatResponse | undefined;

  // Handle one event; returns the final ChatResponse when the done event lands.
  const dispatch = (payload: string): ChatResponse | undefined => {
    let ev: StreamEvent;
    try {
      ev = JSON.parse(payload) as StreamEvent;
    } catch {
      return undefined;
    }
    if (typeof ev.error === 'string') throw new Error(`chat stream error: ${ev.error}`);
    if (Array.isArray(ev.retrieved)) retrieved = ev.retrieved as Retrieved[];
    if (ev.done) {
      return {
        text: typeof ev.text === 'string' ? ev.text : acc,
        cites: Array.isArray(ev.cites) ? (ev.cites as Cite[]) : [],
        retrieved,
      };
    }
    if (Array.isArray(ev.retrieved)) cb.onRetrieved?.(ev.retrieved as Retrieved[]);
    if (typeof ev.chunk === 'string' && ev.chunk) {
      acc += ev.chunk;
      cb.onChunk?.(ev.chunk);
    }
    return undefined;
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, '');
      buf = buf.slice(nl + 1);
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      else if (line === '' && dataLines.length > 0) {
        final = dispatch(dataLines.join('\n')) ?? final;
        dataLines = [];
      }
    }
  }
  // Flush a final event whose terminating newline(s) never arrived.
  for (const tail of (buf + decoder.decode()).split('\n')) {
    const line = tail.replace(/\r$/, '');
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length > 0) final = dispatch(dataLines.join('\n')) ?? final;

  if (final) return final;
  // The stream dropped before the done event: keep the partial text we already
  // showed (no cites) instead of failing over to a simulated answer.
  if (acc) return { text: acc, cites: [], retrieved };
  throw new Error('chat stream ended without data');
}

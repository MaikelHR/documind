/* DocuMind - application root: state, live answer streaming, theming, i18n wiring, view routing. */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePick } from './i18n/usePick';
import type { PickFn } from './i18n/usePick';
import { buildUnits } from './lib/markup';
import { IngestError, RateLimitedError, deleteUploadedDoc, fetchSessionDocs, ingestDocument, requestAnswer } from './lib/api';
import { DOCS, SEED, SUGGESTIONS, UPLOAD_NAMES, pickAnswer } from './data/sample';
import type { AiMessage, Cite, Direction, Doc, Lang, Message, Mode, Retrieved, UserMessage } from './types';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Composer } from './components/Composer';
import { EmptyState } from './components/EmptyState';
import { Landing } from './components/Landing';
import { Message as MessageView } from './components/chat/Message';
import { SourceDrawer } from './components/chat/SourceDrawer';
import { Ic } from './components/icons';

let uploadSeq = 0;
/** Sidebar id for an upload in flight (module counter: stable across renders). */
const nextUploadId = () => 'up' + ++uploadSeq;

function nowTime(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Build the seeded conversation resolved into one language. */
function buildSeed(pick: PickFn): Message[] {
  return SEED.map((m) => {
    const text = pick(m.text);
    if (m.role === 'ai') {
      const cites: Cite[] = m.cites.map((c) => ({ ...c, snippet: pick(c.snippet) }));
      const ai: AiMessage = { id: m.id, role: 'ai', text, cites, phase: 'done', units: buildUnits(text), revealed: 9999, time: m.time };
      return ai;
    }
    const user: UserMessage = { id: m.id, role: 'user', text, time: m.time };
    return user;
  });
}

export default function App() {
  const { t, i18n } = useTranslation();
  const pick = usePick();
  const lang: Lang = i18n.language && i18n.language.startsWith('en') ? 'en' : 'es';

  const [view, setView] = useState<'landing' | 'app'>('app');
  const [direction, setDirection] = useState<Direction>(() => (localStorage.getItem('dm-dir-v2') as Direction) || 'verdigris');
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('dm-mode') as Mode) || 'dark');
  const [docs, setDocs] = useState<Doc[]>(() => DOCS.map((d) => ({ ...d, indexing: false })));
  const [query, setQuery] = useState('');
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawer, setDrawer] = useState<{ open: boolean; cite: Cite | null }>({ open: false, cite: null });
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => buildSeed(pick));

  const threadRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const streamIdRef = useRef<string | undefined>(undefined);
  const firstLangRun = useRef(true);

  // theme: apply + persist
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.direction = direction;
    r.dataset.mode = mode;
    localStorage.setItem('dm-dir-v2', direction);
    localStorage.setItem('dm-mode', mode);
  }, [direction, mode]);

  // language: persist + rebuild the seeded demo in the new language (skip first mount)
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('dm-lang', lang);
    if (firstLangRun.current) {
      firstLangRun.current = false;
      return;
    }
    abortRef.current?.abort();
    streamIdRef.current = undefined;
    clearInterval(intervalRef.current);
    clearTimeout(revealTimerRef.current);
    setStreaming(false);
    setDrawer({ open: false, cite: null });
    setMessages(docs.length === 0 ? [] : buildSeed(pick));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // keep thread pinned to latest only when new messages arrive or while streaming
  const prevLenRef = useRef(messages.length);
  useEffect(() => {
    const el = threadRef.current;
    if (el && (messages.length > prevLenRef.current || streaming)) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
    prevLenRef.current = messages.length;
  }, [messages, streaming, view]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      clearInterval(intervalRef.current);
      clearTimeout(revealTimerRef.current);
    },
    [],
  );

  // Uploaded docs survive page reloads: on mount, rebuild the sidebar from the
  // backend (source of truth - expired uploads drop off naturally). Plain
  // `vite dev` (no /api) just keeps the fixed corpus.
  useEffect(() => {
    let stale = false;
    fetchSessionDocs()
      .then((remote) => {
        if (stale || remote.length === 0) return;
        setDocs((d) => {
          const have = new Set(d.map((x) => x.id));
          const add: Doc[] = remote
            .filter((r) => !have.has(r.docId))
            .map((r) => ({
              id: r.docId,
              name: r.name,
              ext: r.ext,
              pages: r.pages,
              kind: r.ext.toLowerCase(),
              indexed: true,
              indexing: false,
              progress: 100,
              content: {},
            }));
          return add.length > 0 ? [...add, ...d] : d;
        });
      })
      .catch(() => {
        /* no backend (vite dev) or transient error - fixed corpus only */
      });
    return () => {
      stale = true;
    };
  }, []);

  const scopeCount = docs.filter((d) => d.indexed).length;

  // Reveal an already-complete answer word-by-word (streaming -> done). Used
  // by the non-stream paths: simulated fallback and the rate-limit notice.
  const beginReveal = (aiId: string, ansText: string, cites: Cite[]) => {
    const units = buildUnits(ansText);
    setMessages((m) =>
      m.map((x) =>
        x.id === aiId && x.role === 'ai'
          ? { ...x, text: ansText, cites, units, phase: 'streaming' as const, revealed: 0 }
          : x,
      ),
    );
    requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    if (units.length === 0) {
      setMessages((m) => m.map((x) => (x.id === aiId && x.role === 'ai' ? { ...x, phase: 'done' as const } : x)));
      setStreaming(false);
      streamIdRef.current = undefined;
      return;
    }
    intervalRef.current = setInterval(() => {
      setMessages((m) => {
        let done = false;
        const next = m.map((x) => {
          if (x.id !== aiId || x.role !== 'ai') return x;
          const r = x.revealed + 1;
          if (r >= x.units.length) {
            done = true;
            return { ...x, revealed: x.units.length, phase: 'done' as const };
          }
          return { ...x, revealed: r };
        });
        if (done) {
          clearInterval(intervalRef.current);
          setStreaming(false);
          streamIdRef.current = undefined;
        }
        return next;
      });
    }, 24);
  };

  // Ask the real backend and stream the answer: the thinking phase shows the
  // top-k passages as soon as the server retrieves them, then each real text
  // chunk lands in the bubble as Gemini generates it (no simulated reveal).
  // Falls back to the simulated answer bank if /api/chat is unreachable or
  // errors (e.g. plain `vite dev` with no functions, or a missing API key).
  const send = (text: string) => {
    if (!text || streaming || docs.length === 0) return;
    const tm = nowTime();
    const userMsg: UserMessage = { id: 'u' + Date.now(), role: 'user', text, time: tm };
    const aiId = 'a' + Date.now();
    const aiMsg: AiMessage = { id: aiId, role: 'ai', phase: 'thinking', text: '', cites: [], units: [], revealed: 0, time: tm };
    setMessages((m) => [...m, userMsg, aiMsg]);
    setStreaming(true);
    streamIdRef.current = aiId;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    let acc = ''; // text streamed so far; also tells the handlers below apart from the no-stream path
    const finishStream = (ansText: string, cites: Cite[], retrieved?: Retrieved[]) => {
      const units = buildUnits(ansText);
      setMessages((m) =>
        m.map((x) =>
          x.id === aiId && x.role === 'ai'
            ? { ...x, text: ansText, cites, retrieved: retrieved ?? x.retrieved, units, revealed: units.length, phase: 'done' as const }
            : x,
        ),
      );
      setStreaming(false);
      streamIdRef.current = undefined;
    };

    void requestAnswer(
      text,
      lang,
      {
        onRetrieved: (retrieved) => {
          if (streamIdRef.current !== aiId) return;
          setMessages((m) => m.map((x) => (x.id === aiId && x.role === 'ai' ? { ...x, retrieved } : x)));
        },
        onChunk: (delta) => {
          if (streamIdRef.current !== aiId) return;
          acc += delta;
          const units = buildUnits(acc);
          setMessages((m) =>
            m.map((x) =>
              x.id === aiId && x.role === 'ai'
                ? { ...x, text: acc, units, revealed: units.length, phase: 'streaming' as const }
                : x,
            ),
          );
        },
      },
      ctrl.signal,
    )
      .then((res) => {
        if (streamIdRef.current !== aiId) return; // superseded by stop / lang change / new chat
        if (acc) {
          // Streamed for real: the text is already on screen, pin the
          // authoritative final text + cites and finish.
          finishStream(res.text, res.cites, res.retrieved);
          return;
        }
        // No-stream JSON response: surface the retrieved passages in the
        // thinking steps for a beat (the staggered steps need ~1.4s to play),
        // then animate the reveal as before.
        setMessages((m) => m.map((x) => (x.id === aiId && x.role === 'ai' ? { ...x, retrieved: res.retrieved ?? [] } : x)));
        revealTimerRef.current = setTimeout(() => {
          if (streamIdRef.current !== aiId) return;
          beginReveal(aiId, res.text, res.cites);
        }, 1450);
      })
      .catch((err) => {
        if (ctrl.signal.aborted || streamIdRef.current !== aiId) return;
        if (err instanceof RateLimitedError) {
          // Rate limit hit: say so instead of silently faking an answer.
          beginReveal(aiId, t('rateLimited'), []);
          return;
        }
        if (import.meta.env.DEV) console.warn('chat API failed, using simulated fallback:', err);
        if (acc) {
          // The stream broke mid-answer: keep the partial real text rather
          // than swapping in a simulated answer.
          finishStream(acc, []);
          return;
        }
        const ans = pickAnswer(text);
        const cites: Cite[] = ans.cites.map((c) => ({ ...c, snippet: pick(c.snippet) }));
        beginReveal(aiId, pick(ans.text), cites);
      });
  };

  const stop = () => {
    abortRef.current?.abort();
    clearInterval(intervalRef.current);
    clearTimeout(revealTimerRef.current);
    const aiId = streamIdRef.current;
    streamIdRef.current = undefined;
    setMessages((m) => m.map((x) => (x.id === aiId && x.role === 'ai' ? { ...x, phase: 'done' as const, revealed: x.units.length } : x)));
    setStreaming(false);
  };

  // Real upload: POST the PDF to /api/ingest (parse -> chunk -> embed ->
  // pgvector) with coarse progress, then surface it as a queryable source
  // with its real page count. Rejections (size, quota, scanned PDF) show a
  // brief error on the item; if the API is unreachable (plain `vite dev`),
  // fall back to the simulated indexing below.
  const addRealDoc = async (file: File) => {
    const tempId = nextUploadId();
    const doc: Doc = { id: tempId, name: file.name, ext: 'PDF', pages: 0, kind: 'pdf', indexed: false, indexing: true, progress: 8, content: {} };
    setDocs((d) => [doc, ...d]);
    const patch = (p: Partial<Doc>) => setDocs((d) => d.map((x) => (x.id === tempId ? { ...x, ...p } : x)));
    try {
      const res = await ingestDocument(file, lang, (pct) => patch({ progress: pct }));
      setDocs((d) => d.map((x) => (x.id === tempId ? { ...x, id: res.docId, pages: res.pages, indexing: false, indexed: true, progress: 100 } : x)));
    } catch (err) {
      if (err instanceof IngestError) {
        const key =
          err.code === 'file_too_large' || err.code === 'too_many_pages' || err.code === 'doc_too_large'
            ? 'upTooBig'
            : err.code === 'rate_limited'
              ? 'upLimit'
              : err.code === 'no_text' || err.code === 'pdf_parse_failed'
                ? 'upNoText'
                : 'upFailed';
        patch({ indexing: false, error: t(key) });
        setTimeout(() => setDocs((d) => d.filter((x) => x.id !== tempId)), 5000);
        return;
      }
      if (import.meta.env.DEV) console.warn('ingest API unreachable, simulating:', err);
      setDocs((d) => d.filter((x) => x.id !== tempId));
      addSimDoc(file.name);
    }
  };

  // Simulated indexing - kept ONLY as the no-backend fallback (plain `vite
  // dev`) and for non-PDF formats, like the simulated answer bank.
  const addSimDoc = (name?: string) => {
    const pool = UPLOAD_NAMES[lang] || UPLOAD_NAMES.en;
    const nm = name || pool[Math.floor(Math.random() * pool.length)];
    const ext = (nm.split('.').pop() || 'pdf').toUpperCase().slice(0, 4);
    const id = 'doc' + Date.now();
    const pages = Math.floor(Math.random() * 28) + 7;
    const doc: Doc = {
      id,
      name: nm,
      ext,
      pages: ext === 'MD' ? 'Note' : pages,
      kind: ext.toLowerCase(),
      indexed: false,
      indexing: true,
      progress: 0,
      content: {},
    };
    setDocs((d) => [doc, ...d]);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.floor(Math.random() * 16) + 9;
      if (p >= 100) {
        clearInterval(iv);
        setDocs((d) => d.map((x) => (x.id === id ? { ...x, indexing: false, indexed: true, progress: 100 } : x)));
      } else {
        setDocs((d) => d.map((x) => (x.id === id ? { ...x, progress: p } : x)));
      }
    }, 230);
  };

  // PDFs go through the real pipeline; anything else (or a bare name from the
  // demo paths) keeps the simulated indexing.
  const addDoc = (input?: File | string) => {
    if (input instanceof File && /\.pdf$/i.test(input.name)) {
      void addRealDoc(input);
      return;
    }
    addSimDoc(input instanceof File ? input.name : input);
  };

  const deleteDoc = (id: string) => {
    // Real uploads ('u-' ids) also drop their stored chunks - otherwise the
    // doc would reappear on the next reload (the sidebar rebuilds from the DB).
    if (id.startsWith('u-')) deleteUploadedDoc(id);
    setDocs((d) => d.filter((x) => x.id !== id));
    if (activeDocId === id) {
      setActiveDocId(null);
      setDrawer({ open: false, cite: null });
    }
  };

  const openSource = (cite: Cite) => {
    setDrawer({ open: true, cite });
    setActiveDocId(cite.docId);
  };
  const closeDrawer = () => setDrawer((d) => ({ ...d, open: false }));

  const newChat = () => {
    abortRef.current?.abort();
    streamIdRef.current = undefined;
    clearInterval(intervalRef.current);
    clearTimeout(revealTimerRef.current);
    setStreaming(false);
    setMessages([]);
    setDrawer({ open: false, cite: null });
    setActiveDocId(null);
    setSidebarOpen(false);
  };

  const loadSamples = () => {
    setDocs(DOCS.map((d) => ({ ...d, indexing: false })));
    setMessages(buildSeed(pick));
  };

  const regen = (aiId: string) => {
    if (streaming) return;
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === aiId);
      if (i < 1) return prev;
      const userText = prev[i - 1] && prev[i - 1].text;
      const trimmed = prev.slice(0, i - 1);
      if (userText) setTimeout(() => send(userText), 30);
      return trimmed;
    });
  };

  const sWord = scopeCount === 1 ? t('sourceN') : t('sourcesN');
  const indWord = scopeCount === 1 ? t('indexedF') : t('indexedP');

  return (
    <div className="shell">
      <TopBar
        direction={direction}
        mode={mode}
        lang={lang}
        inApp={view === 'app'}
        onDir={setDirection}
        onMode={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
        onLang={(l) => {
          void i18n.changeLanguage(l);
        }}
        onBrand={() => setView('landing')}
        onMenu={() => setSidebarOpen((o) => !o)}
      />

      {view === 'landing' ? (
        <Landing onOpen={() => setView('app')} />
      ) : (
        <div className="workspace">
          <Sidebar
            docs={docs}
            activeDocId={activeDocId}
            onSelect={(id) => setActiveDocId(id)}
            onDelete={deleteDoc}
            onAdd={(n) => {
              addDoc(n);
              setSidebarOpen(false);
            }}
            onNewChat={newChat}
            query={query}
            setQuery={setQuery}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <main className="chat">
            <div className="chat-head">
              <div className="ttl">
                <h2>{docs.length === 0 ? t('newWorkspace') : t('workspaceTitle')}</h2>
                <div className="sub">{t('sourcesIndexed', { n: scopeCount, s: sWord, ind: indWord })}</div>
              </div>
              <div className="head-actions">
                <span className="model-chip">
                  <Ic.shield style={{ width: 13, height: 13 }} /> {t('grounded')} <span className="mc-sep" /> Gemini 2.5 Flash
                </span>
                <button className="icon-btn" title={t('newChatTitle')} onClick={newChat}>
                  <Ic.edit />
                </button>
              </div>
            </div>

            {docs.length === 0 ? (
              <EmptyState onUpload={addDoc} onLoadSamples={loadSamples} />
            ) : (
              <>
                <div className="thread scroll" ref={threadRef}>
                  <div className="thread-inner">
                    {messages.length === 0 ? (
                      <div className="thread-empty">
                        <span className="te-mark">
                          <Ic.spark />
                        </span>
                        <h3>{t('teH', { n: scopeCount, s: sWord })}</h3>
                        <p>{t('teP')}</p>
                      </div>
                    ) : (
                      messages.map((m) => <MessageView key={m.id} msg={m} onOpen={openSource} onRegen={regen} docCount={scopeCount} />)
                    )}
                  </div>
                </div>
                <Composer
                  streaming={streaming}
                  onSend={send}
                  onStop={stop}
                  scopeCount={scopeCount}
                  suggestions={messages.length <= 2 ? pick(SUGGESTIONS) : null}
                  onSuggest={send}
                />
              </>
            )}

            <SourceDrawer cite={drawer.cite} open={drawer.open} onClose={closeDrawer} />
          </main>
        </div>
      )}
    </div>
  );
}

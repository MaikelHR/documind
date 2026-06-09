/* DocuMind - application root: state, streaming simulation, theming, i18n wiring, view routing. */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePick } from './i18n/usePick';
import type { PickFn } from './i18n/usePick';
import { buildUnits } from './lib/markup';
import { requestAnswer } from './lib/api';
import { DOCS, SEED, SUGGESTIONS, UPLOAD_NAMES, pickAnswer } from './data/sample';
import type { AiMessage, Cite, Direction, Doc, Lang, Message, Mode, UserMessage } from './types';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Composer } from './components/Composer';
import { EmptyState } from './components/EmptyState';
import { Landing } from './components/Landing';
import { Message as MessageView } from './components/chat/Message';
import { SourceDrawer } from './components/chat/SourceDrawer';
import { Ic } from './components/icons';

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
    },
    [],
  );

  const scopeCount = docs.filter((d) => d.indexed).length;

  // Reveal a finished answer word-by-word (the streaming -> done phases). The
  // text + cites come from the backend; here we just animate them in.
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

  // Ask the real backend; the thinking phase stays up while it works. Falls
  // back to the simulated answer bank if /api/chat is unreachable or errors
  // (e.g. plain `vite dev` with no functions, or a missing API key).
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

    void requestAnswer(text, lang, ctrl.signal)
      .then((res) => {
        if (streamIdRef.current !== aiId) return; // superseded by stop / lang change / new chat
        beginReveal(aiId, res.text, res.cites);
      })
      .catch((err) => {
        if (ctrl.signal.aborted || streamIdRef.current !== aiId) return;
        if (import.meta.env.DEV) console.warn('chat API failed, using simulated fallback:', err);
        const ans = pickAnswer(text);
        const cites: Cite[] = ans.cites.map((c) => ({ ...c, snippet: pick(c.snippet) }));
        beginReveal(aiId, pick(ans.text), cites);
      });
  };

  const stop = () => {
    abortRef.current?.abort();
    clearInterval(intervalRef.current);
    const aiId = streamIdRef.current;
    streamIdRef.current = undefined;
    setMessages((m) => m.map((x) => (x.id === aiId && x.role === 'ai' ? { ...x, phase: 'done' as const, revealed: x.units.length } : x)));
    setStreaming(false);
  };

  const addDoc = (name?: string) => {
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

  const deleteDoc = (id: string) => {
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
              <EmptyState onUpload={() => addDoc()} onLoadSamples={loadSamples} />
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
                      messages.map((m) => <MessageView key={m.id} msg={m} onOpen={openSource} onRegen={regen} />)
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

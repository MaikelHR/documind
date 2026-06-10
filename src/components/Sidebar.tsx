/* DocuMind - Sidebar: new chat, search, chat history, source list, dropzone
   (off-canvas on mobile). The CHATS section lists saved conversations
   (localStorage); clicking one restores it, the trash removes it. */

import { useTranslation } from 'react-i18next';
import type { ChatEntry, Doc } from '../types';
import { DocItem } from './DocItem';
import { DropZone } from './DropZone';
import { Ic } from './icons';

/** Compact stamp: time for today's chats, short date for older ones. */
function chatStamp(ts: number): string {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

interface SidebarProps {
  docs: Doc[];
  activeDocId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (file?: File | string) => void;
  onNewChat: () => void;
  chats: ChatEntry[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  docs,
  activeDocId,
  onSelect,
  onDelete,
  onAdd,
  onNewChat,
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  query,
  setQuery,
  open,
  onClose,
}: SidebarProps) {
  const { t } = useTranslation();
  const filtered = docs.filter((d) => {
    const nm = (typeof d.name === 'object' ? d.name.es + ' ' + d.name.en : d.name).toLowerCase();
    return nm.includes(query.toLowerCase());
  });
  return (
    <>
      <div className={'sidebar-scrim' + (open ? ' open' : '')} onClick={onClose} />
      <aside className={'sidebar' + (open ? ' open' : '')}>
        <div className="side-head">
          <button className="new-chat" onClick={onNewChat}>
            <Ic.edit style={{ width: 15, height: 15 }} /> {t('newChat')}
          </button>
          <label className="search">
            <Ic.search />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchPh')} />
            <span className="search-k">⌘K</span>
          </label>
        </div>
        {chats.length > 0 && (
          <>
            <div className="side-section">
              <span className="side-label">{t('chats')}</span>
              <span className="side-count">{chats.length}</span>
            </div>
            <div className="chat-list scroll">
              {chats.map((c) => (
                <div
                  key={c.id}
                  className={'chat-item' + (c.id === activeChatId ? ' active' : '')}
                  onClick={() => onSelectChat(c.id)}
                >
                  <span className="chat-ic">
                    <Ic.chat />
                  </span>
                  <div className="chat-meta">
                    <div className="chat-title">{c.title}</div>
                    <div className="chat-sub">{chatStamp(c.createdAt)}</div>
                  </div>
                  <button
                    className="doc-del"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(c.id);
                    }}
                    aria-label={t('delChat')}
                  >
                    <Ic.trash />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="side-section">
          <span className="side-label">{t('sources')}</span>
          <span className="side-count">{docs.length}</span>
        </div>
        <div className="doc-list scroll">
          {filtered.map((d) => (
            <DocItem key={d.id} doc={d} active={d.id === activeDocId} onSelect={onSelect} onDelete={onDelete} />
          ))}
          {filtered.length === 0 && docs.length > 0 && <div className="doc-none">{t('noMatch', { q: query })}</div>}
        </div>
        <div className="side-foot">
          <DropZone onAdd={onAdd} />
        </div>
      </aside>
    </>
  );
}

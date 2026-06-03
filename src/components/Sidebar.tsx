/* DocuMind - Sidebar: new chat, search, source list, dropzone (off-canvas on mobile). */

import { useTranslation } from 'react-i18next';
import type { Doc } from '../types';
import { DocItem } from './DocItem';
import { DropZone } from './DropZone';
import { Ic } from './icons';

interface SidebarProps {
  docs: Doc[];
  activeDocId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (name?: string) => void;
  onNewChat: () => void;
  query: string;
  setQuery: (q: string) => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ docs, activeDocId, onSelect, onDelete, onAdd, onNewChat, query, setQuery, open, onClose }: SidebarProps) {
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

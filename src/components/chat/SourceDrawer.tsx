/* DocuMind — SourceDrawer: slide-in original document page with the cited
   passage wrapped in <mark>; flashes and auto-scrolls into view on open. */

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePick } from '../../i18n/usePick';
import { docById } from '../../data/sample';
import type { Cite, PageContent } from '../../types';
import { Ic } from '../icons';

function highlightPara(para: string, snippet: string): ReactNode {
  if (!snippet) return para;
  const idx = para.indexOf(snippet);
  if (idx < 0) return para;
  return [para.slice(0, idx), <mark key="m">{snippet}</mark>, para.slice(idx + snippet.length)];
}

interface SourceDrawerProps {
  cite: Cite | null;
  open: boolean;
  onClose: () => void;
}

export function SourceDrawer({ cite, open, onClose }: SourceDrawerProps) {
  const { t } = useTranslation();
  const pick = usePick();
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const doc = cite ? docById(cite.docId) : null;
  const pages = doc ? (pick(doc.content) as PageContent) : null;
  const paras: string[] = (pages && cite ? pages[cite.page as number] : undefined) || [];

  useEffect(() => {
    if (open && bodyRef.current) {
      const m = bodyRef.current.querySelector('mark');
      if (m) bodyRef.current.scrollTop = Math.max(0, (m as HTMLElement).offsetTop - 120);
    }
  }, [open, cite]);

  return (
    <>
      <div className={'drawer-scrim' + (open ? ' open' : '')} onClick={onClose} />
      <aside className={'drawer' + (open ? ' open' : '')} aria-hidden={!open}>
        {doc && cite && (
          <>
            <div className="drawer-head">
              <span className="d-ic">
                <span className="ext">{doc.ext}</span>
              </span>
              <div className="d-info">
                <div className="d-name">{pick(doc.name)}</div>
                <div className="d-pg">
                  {typeof cite.page === 'number' ? t('pageOf', { p: cite.page, total: doc.pages }) : cite.page} ·{' '}
                  {t('citedAs', { n: cite.n })}
                </div>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <Ic.close />
              </button>
            </div>
            <div className="drawer-body scroll" ref={bodyRef}>
              <div className="page-sheet">
                <div className="pg-h">
                  {pick(doc.name).replace(/\.[a-z]+$/i, '')} —{' '}
                  {typeof cite.page === 'number' ? 'p. ' + cite.page : cite.page}
                </div>
                {paras.map((p, i) =>
                  i === 0 ? (
                    <p key={i} className="pg-title">
                      {p}
                    </p>
                  ) : (
                    <p key={i}>{highlightPara(p, cite.snippet)}</p>
                  ),
                )}
              </div>
            </div>
            <div className="drawer-foot">
              <span>
                <Ic.quote style={{ width: 12, height: 12, verticalAlign: '-2px', marginRight: 6 }} />
                {t('verified')}
              </span>
              <span>
                {doc.ext} · {doc.pages}
                {typeof doc.pages === 'number' ? ' ' + t('pp') : ''}
              </span>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

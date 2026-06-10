/* DocuMind - SourceDrawer: slide-in original document page with the cited
   passage wrapped in <mark>; flashes and auto-scrolls into view on open.
   Fixed-corpus pages come from shared/corpus.ts (same source the backend
   cites from). Pages of user-uploaded docs don't exist locally: they are
   fetched from /api/page, which returns the stored chunks of that page - the
   exact paragraphs the snippet was cut from - so the indexOf highlight works
   identically for both. */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePick } from '../../i18n/usePick';
import { docMeta, pageParagraphs } from '../../../shared/corpus';
import { fetchUploadedPage } from '../../lib/api';
import type { Cite, Lang } from '../../types';
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
  const { t, i18n } = useTranslation();
  const pick = usePick();
  const lang: Lang = i18n.language && i18n.language.startsWith('en') ? 'en' : 'es';
  const bodyRef = useRef<HTMLDivElement | null>(null);
  // Fetched paragraphs of an uploaded page, keyed by docId|page so a cite
  // change implicitly resets to [] (no setState-in-effect reset needed).
  const [remote, setRemote] = useState<{ key: string; paras: string[] } | null>(null);

  const corpusDoc = cite ? docMeta(cite.docId) : null;
  // A docId the local corpus doesn't know = a user upload; its metadata
  // travels on the cite itself (docName/ext/pages from the backend).
  const isUpload = Boolean(cite && !corpusDoc);

  const name: string = corpusDoc ? pick(corpusDoc.name) : cite?.docName ?? cite?.docId ?? '';
  const ext = corpusDoc ? corpusDoc.ext : cite?.ext ?? 'PDF';
  const pages: number | string = corpusDoc ? corpusDoc.pages : cite?.pages ?? '';

  const upDocId = isUpload && cite ? cite.docId : '';
  const upPage = isUpload && cite && typeof cite.page === 'number' ? cite.page : 0;
  const upSnippet = (isUpload && cite?.snippet) || '';
  const upKey = `${upDocId}|${upPage}`;

  const paras: string[] = useMemo(
    () =>
      cite && corpusDoc
        ? pageParagraphs(cite.docId, cite.page as number, lang)
        : remote && remote.key === upKey
          ? remote.paras
          : [],
    [cite, corpusDoc, lang, remote, upKey],
  );

  // Uploaded docs: fetch the page's stored paragraphs when the drawer opens.
  useEffect(() => {
    if (!open || !upDocId || upPage < 1) return;
    let stale = false;
    fetchUploadedPage(upDocId, upPage)
      .then((p) => {
        if (!stale) setRemote({ key: upKey, paras: p.paras });
      })
      .catch(() => {
        // Page gone (expired upload / other session): show the snippet alone.
        if (!stale) setRemote({ key: upKey, paras: upSnippet ? [upSnippet] : [] });
      });
    return () => {
      stale = true;
    };
  }, [open, upDocId, upPage, upKey, upSnippet]);

  useEffect(() => {
    if (open && bodyRef.current) {
      const m = bodyRef.current.querySelector('mark');
      if (m) bodyRef.current.scrollTop = Math.max(0, (m as HTMLElement).offsetTop - 120);
    }
  }, [open, cite, paras]);

  return (
    <>
      <div className={'drawer-scrim' + (open ? ' open' : '')} onClick={onClose} />
      <aside className={'drawer' + (open ? ' open' : '')} aria-hidden={!open}>
        {cite && (
          <>
            <div className="drawer-head">
              <span className="d-ic">
                <span className="ext">{ext}</span>
              </span>
              <div className="d-info">
                <div className="d-name">{name}</div>
                <div className="d-pg">
                  {typeof cite.page === 'number' && typeof pages === 'number'
                    ? t('pageOf', { p: cite.page, total: pages })
                    : cite.page}{' '}
                  · {t('citedAs', { n: cite.n })}
                </div>
              </div>
              <button className="icon-btn" onClick={onClose} aria-label="Close">
                <Ic.close />
              </button>
            </div>
            <div className="drawer-body scroll" ref={bodyRef}>
              <div className="page-sheet">
                <div className="pg-h">
                  {name.replace(/\.[a-z]+$/i, '')} - {typeof cite.page === 'number' ? 'p. ' + cite.page : cite.page}
                </div>
                {paras.map((p, i) =>
                  // Corpus pages carry a section heading as their first entry;
                  // uploaded pages are plain paragraphs (all highlightable).
                  !isUpload && i === 0 ? (
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
                {ext} · {pages}
                {typeof pages === 'number' ? ' ' + t('pp') : ''}
              </span>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

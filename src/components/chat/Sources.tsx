/* DocuMind — Sources: grid of citation cards under a finished answer.
   Hovering a card lights it (and its inline marker via shared `lit` state). */

import { useTranslation } from 'react-i18next';
import { usePick } from '../../i18n/usePick';
import { docById } from '../../data/sample';
import type { Cite } from '../../types';
import { Ic } from '../icons';

interface SourcesProps {
  cites: Cite[];
  lit: number | null;
  setLit: (n: number | null) => void;
  onOpen: (c: Cite) => void;
}

export function Sources({ cites, lit, setLit, onOpen }: SourcesProps) {
  const { t } = useTranslation();
  const pick = usePick();
  return (
    <div className="cites">
      <div className="cites-label">
        <span>{t('sourcesLabel')}</span>
        <span className="cites-n">{cites.length}</span>
      </div>
      <div className="cite-grid">
        {cites.map((c) => {
          const doc = docById(c.docId);
          return (
            <button
              key={c.n}
              className={'cite' + (lit === c.n ? ' lit' : '')}
              onMouseEnter={() => setLit(c.n)}
              onMouseLeave={() => setLit(null)}
              onClick={() => onOpen(c)}
            >
              <span className="cite-head">
                <span className="cite-n">{c.n}</span>
                <span className="cite-doc">{doc ? pick(doc.name) : c.docId}</span>
              </span>
              <span className="cite-snip">{c.snippet}</span>
              <span className="cite-foot">
                <span className="cite-meta">
                  {doc ? doc.ext : 'DOC'}
                  <span className="dot-sep" />
                  {typeof c.page === 'number' ? t('pageShort', { n: c.page }) : c.page}
                </span>
                <span className="cite-open">
                  {t('open')}
                  <Ic.arrow style={{ width: 13, height: 13 }} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

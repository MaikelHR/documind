/* DocuMind - DocItem: a single source row (thumbnail, name, indexed/indexing state). */

import { useTranslation } from 'react-i18next';
import { usePick } from '../i18n/usePick';
import type { Doc } from '../types';
import { Ic } from './icons';

function DocThumb({ ext, kind }: { ext: string; kind?: string }) {
  return (
    <span className={'doc-ic k-' + (kind || 'pdf')}>
      <span className="doc-ic-glyph">
        <Ic.file />
      </span>
      <span className="ext">{ext}</span>
    </span>
  );
}

interface DocItemProps {
  doc: Doc;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function DocItem({ doc, active, onSelect, onDelete }: DocItemProps) {
  const { t } = useTranslation();
  const pick = usePick();
  const pageLabel = typeof doc.pages === 'number' ? doc.pages + ' ' + t('pages') : t('note');
  return (
    <div
      className={'doc' + (active ? ' active' : '') + (doc.indexing ? ' indexing' : '')}
      onClick={() => !doc.indexing && onSelect(doc.id)}
    >
      <DocThumb ext={doc.ext} kind={doc.kind} />
      <div className="doc-meta">
        <div className="doc-name">{pick(doc.name)}</div>
        {doc.indexing ? (
          <>
            <div className="doc-prog">
              <i style={{ width: (doc.progress ?? 0) + '%' }} />
            </div>
            <div className="doc-sub idx">
              {t('indexing')} · {doc.progress ?? 0}%
            </div>
          </>
        ) : (
          <div className="doc-sub">
            <span>{pageLabel}</span>
            <span className="dot-sep" />
            <span className="stat">
              <Ic.check style={{ width: 11, height: 11 }} /> {t('indexed')}
            </span>
          </div>
        )}
      </div>
      {!doc.indexing && (
        <button
          className="doc-del"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doc.id);
          }}
          aria-label={t('regenerate')}
        >
          <Ic.trash />
        </button>
      )}
    </div>
  );
}

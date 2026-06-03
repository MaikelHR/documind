/* DocuMind — EmptyState: editorial prompt shown when there are no documents. */

import { useTranslation } from 'react-i18next';
import { DropZone } from './DropZone';
import { Ic } from './icons';

interface EmptyStateProps {
  onUpload: () => void;
  onLoadSamples: () => void;
}

export function EmptyState({ onUpload, onLoadSamples }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="empty">
      <div className="empty-inner">
        <span className="empty-eyebrow">{t('emptyEye')}</span>
        <h1 className="empty-h1">
          {t('emptyH1a')}
          <em>{t('emptyH1em')}</em>
        </h1>
        <p className="empty-sub">{t('emptySub')}</p>
        <DropZone big onAdd={onUpload} />
        <div className="empty-samples">
          <span className="es-label">{t('noFiles')}</span>
          <button className="es-load" onClick={onLoadSamples}>
            {t('loadSample')} <Ic.arrow style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

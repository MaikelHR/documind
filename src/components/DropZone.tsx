/* DocuMind - DropZone: click or drag-and-drop to add documents. */

import { useState } from 'react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Ic } from './icons';

interface DropZoneProps {
  onAdd: (name?: string) => void;
  big?: boolean;
}

export function DropZone({ onAdd, big }: DropZoneProps) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) {
      [...files].forEach((f) => onAdd(f.name));
    } else {
      onAdd();
    }
  };
  return (
    <div
      className={'dropzone' + (big ? ' big' : '') + (drag ? ' drag' : '')}
      onClick={() => onAdd()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <div className="dz-ic">
        <Ic.upload />
      </div>
      <div className="dz-title">
        {drag ? (
          <b>{t('dzDrag')}</b>
        ) : (
          <>
            {t('dzIdle')}
            <b>{t('dzBrowse')}</b>
          </>
        )}
      </div>
      <div className="dz-sub">{t('dzFormats')}</div>
    </div>
  );
}

/* DocuMind - DropZone: click (real file picker) or drag-and-drop to add
   documents. Hands the actual File up to the app: PDFs are uploaded for real
   indexing (/api/ingest); anything else (or no backend) uses the simulated
   indexing fallback. */

import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Ic } from './icons';

interface DropZoneProps {
  onAdd: (file?: File | string) => void;
  big?: boolean;
}

export function DropZone({ onAdd, big }: DropZoneProps) {
  const { t } = useTranslation();
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) {
      [...files].forEach((f) => onAdd(f));
    } else {
      onAdd();
    }
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length) [...files].forEach((f) => onAdd(f));
    e.target.value = ''; // allow re-picking the same file
  };
  return (
    <div
      className={'dropzone' + (big ? ' big' : '') + (drag ? ' drag' : '')}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      <input ref={inputRef} type="file" accept=".pdf,.docx,.md,.txt" multiple hidden onChange={onPick} />
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

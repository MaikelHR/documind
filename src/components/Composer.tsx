/* DocuMind - Composer: suggestions, auto-growing textarea, send/stop, hint row. */

import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Ic } from './icons';

interface ComposerProps {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  scopeCount: number;
  suggestions: string[] | null;
  onSuggest: (text: string) => void;
}

export function Composer({ streaming, onSend, onStop, scopeCount, suggestions, onSuggest }: ComposerProps) {
  const { t } = useTranslation();
  const [val, setVal] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const grow = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 168) + 'px';
  };
  const submit = () => {
    const tx = val.trim();
    if (!tx || streaming) return;
    onSend(tx);
    setVal('');
    requestAnimationFrame(() => {
      if (ref.current) ref.current.style.height = 'auto';
    });
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };
  const sWord = scopeCount === 1 ? t('sourceN') : t('sourcesN');
  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        {suggestions && suggestions.length > 0 && !streaming && (
          <div className="suggestions">
            <span className="sugg-label">{t('tryLabel')}</span>
            {suggestions.map((s, i) => (
              <button key={i} className="sugg" onClick={() => onSuggest(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="composer">
          <textarea
            ref={ref}
            value={val}
            rows={1}
            onChange={(e) => {
              setVal(e.target.value);
              grow();
            }}
            onKeyDown={onKey}
            placeholder={streaming ? t('answering') : t('askPh')}
            disabled={streaming}
          />
          {streaming ? (
            <button className="send stop" onClick={onStop} aria-label="Stop">
              <Ic.stop />
            </button>
          ) : (
            <button className="send" onClick={submit} disabled={!val.trim()} aria-label={t('send')}>
              <Ic.send />
            </button>
          )}
        </div>
        <div className="composer-hint">
          <span className="scope">
            <Ic.shield style={{ width: 13, height: 13 }} /> {t('groundedAcross', { n: scopeCount, s: sWord })}
          </span>
          <span className="kbar">
            <kbd>↵</kbd> {t('send')} <span className="dot-sep" /> <kbd>⇧↵</kbd> {t('newLine')}
          </span>
        </div>
      </div>
    </div>
  );
}

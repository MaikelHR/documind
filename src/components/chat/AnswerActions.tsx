/* DocuMind - AnswerActions: copy (plain text), regenerate, "every claim cited" note. */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { plainText } from '../../lib/markup';
import type { AiMessage } from '../../types';
import { Ic } from '../icons';

interface AnswerActionsProps {
  msg: AiMessage;
  onRegen: (id: string) => void;
}

export function AnswerActions({ msg, onRegen }: AnswerActionsProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(plainText(msg.text));
    } catch {
      /* clipboard unavailable - ignore */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="ans-actions">
      <button className="aa-btn" onClick={copy}>
        {copied ? <Ic.check style={{ width: 14, height: 14 }} /> : <Ic.copy style={{ width: 14, height: 14 }} />}
        {copied ? t('copied') : t('copy')}
      </button>
      <button className="aa-btn" onClick={() => onRegen(msg.id)}>
        <Ic.refresh style={{ width: 14, height: 14 }} />
        {t('regenerate')}
      </button>
      <span className="aa-note">
        <Ic.shield style={{ width: 12, height: 12 }} /> {t('everyCited')}
      </span>
    </div>
  );
}

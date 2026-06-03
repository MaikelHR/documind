/* DocuMind — Message: a user bubble, or an AI message that moves through
   thinking -> streaming -> done (Retrieval, AiBubble, Sources, AnswerActions). */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Cite, Message as Msg } from '../../types';
import { Ic } from '../icons';
import { AiBubble } from './AiBubble';
import { AnswerActions } from './AnswerActions';
import { Retrieval } from './Retrieval';
import { Sources } from './Sources';

interface MessageProps {
  msg: Msg;
  onOpen: (c: Cite) => void;
  onRegen: (id: string) => void;
}

export function Message({ msg, onOpen, onRegen }: MessageProps) {
  const { t } = useTranslation();
  const [lit, setLit] = useState<number | null>(null);

  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="who">
          <span className="avatar">AR</span>
          <span className="name">{t('you')}</span>
          <span className="time">{msg.time}</span>
        </div>
        <div className="bubble">{msg.text}</div>
      </div>
    );
  }

  const units = msg.units || [];
  const done = msg.phase === 'done';
  return (
    <div className="msg ai">
      <div className="who">
        <span className="avatar">
          <Ic.spark style={{ width: 14, height: 14 }} />
        </span>
        <span className="name">DocuMind</span>
        {done && (
          <span className="grounded-pip">
            <Ic.shield style={{ width: 11, height: 11 }} /> {t('grounded')}
          </span>
        )}
        <span className="time">{msg.time}</span>
      </div>
      {msg.phase === 'thinking' ? (
        <Retrieval cites={msg.cites} />
      ) : (
        <AiBubble
          units={units}
          count={msg.revealed}
          cites={msg.cites}
          streaming={msg.phase === 'streaming'}
          lit={lit}
          setLit={setLit}
          onOpen={onOpen}
        />
      )}
      {done && msg.cites && msg.cites.length ? (
        <Sources cites={msg.cites} lit={lit} setLit={setLit} onOpen={onOpen} />
      ) : null}
      {done ? <AnswerActions msg={msg} onRegen={onRegen} /> : null}
    </div>
  );
}

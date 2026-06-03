/* DocuMind — AiBubble: renders streamed answer units (bold/italic/citation)
   up to `count`, with a blinking accent cursor while streaming. */

import type { ReactNode } from 'react';
import type { Cite, Unit } from '../../types';
import { CiteMarker } from './CiteMarker';

interface AiBubbleProps {
  units: Unit[];
  count: number;
  cites: Cite[];
  streaming: boolean;
  lit: number | null;
  setLit: (n: number | null) => void;
  onOpen: (c: Cite) => void;
}

export function AiBubble({ units, count, cites, streaming, lit, setLit, onOpen }: AiBubbleProps) {
  const map: Record<number, Cite> = {};
  cites.forEach((c) => {
    map[c.n] = c;
  });
  return (
    <div className="bubble">
      {units.slice(0, count).map((u, idx) => {
        if ('cite' in u) {
          return <CiteMarker key={idx} n={u.cite} cite={map[u.cite]} lit={lit} setLit={setLit} onOpen={onOpen} />;
        }
        let node: ReactNode = u.text;
        if (u.bold) node = <strong>{node}</strong>;
        if (u.ital) node = <em>{node}</em>;
        return <span key={idx}>{node}</span>;
      })}
      {streaming && <span className="cursor" />}
    </div>
  );
}

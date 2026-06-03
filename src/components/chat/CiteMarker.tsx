/* DocuMind — CiteMarker: inline [[n]] citation chip; hover lights its source card. */

import type { Cite } from '../../types';

interface CiteMarkerProps {
  n: number;
  lit: number | null;
  setLit: (n: number | null) => void;
  onOpen: (c: Cite) => void;
  cite?: Cite;
}

export function CiteMarker({ n, lit, setLit, onOpen, cite }: CiteMarkerProps) {
  return (
    <sup
      className={'cref' + (lit === n ? ' lit' : '')}
      onMouseEnter={() => setLit(n)}
      onMouseLeave={() => setLit(null)}
      onClick={() => cite && onOpen(cite)}
    >
      {n}
    </sup>
  );
}

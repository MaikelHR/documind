/* DocuMind - tiny inline markup parser.
   Syntax: **bold**, *italic*, and [[n]] citation markers.
   - parseMarkup -> ordered segments
   - buildUnits  -> streaming units (word/whitespace tokens; each [[n]] atomic)
   - plainText   -> strips all markup (used by Copy) */

import type { Unit } from '../types';

type Segment = { text: string; bold: boolean; ital: boolean } | { cite: number };

export function parseMarkup(text: string): Segment[] {
  const segs: Segment[] = [];
  let i = 0;
  let bold = false;
  let ital = false;
  let buf = '';
  const push = () => {
    if (buf) {
      segs.push({ text: buf, bold, ital });
      buf = '';
    }
  };
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      push();
      bold = !bold;
      i += 2;
      continue;
    }
    if (text[i] === '*') {
      push();
      ital = !ital;
      i++;
      continue;
    }
    if (text.startsWith('[[', i)) {
      const end = text.indexOf(']]', i);
      if (end > -1) {
        push();
        segs.push({ cite: parseInt(text.slice(i + 2, end), 10) });
        i = end + 2;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  push();
  return segs;
}

export function buildUnits(text: string): Unit[] {
  const units: Unit[] = [];
  parseMarkup(text).forEach((s) => {
    if ('cite' in s) {
      units.push({ cite: s.cite });
      return;
    }
    (s.text.match(/\s*\S+|\s+/g) || [s.text]).forEach((c) =>
      units.push({ text: c, bold: s.bold, ital: s.ital }),
    );
  });
  return units;
}

export function plainText(text: string): string {
  return (text || '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[\[\d+\]\]/g, '');
}

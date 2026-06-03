/* DocuMind — brand mark: two citation-bracket strokes around a vertical
   "answer" line with a dot on top — "an answer between cited sources". */

import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M8.5 5.5H6.4A1.4 1.4 0 005 6.9v10.2a1.4 1.4 0 001.4 1.4h2.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 5.5h2.1A1.4 1.4 0 0119 6.9v10.2a1.4 1.4 0 01-1.4 1.4h-2.1" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 10.4v6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="6.7" r="1.35" fill="currentColor" />
    </svg>
  );
}

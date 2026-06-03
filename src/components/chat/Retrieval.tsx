/* DocuMind - Retrieval: the "thinking" phase - 4 staggered steps
   (3 completed checks + 1 active spinner). */

import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { usePick } from '../../i18n/usePick';
import { DOCS, docById } from '../../data/sample';
import type { Cite, Doc } from '../../types';
import { Ic } from '../icons';

export function Retrieval({ cites }: { cites: Cite[] }) {
  const { t } = useTranslation();
  const pick = usePick();
  const ids = [...new Set(cites.map((c) => c.docId))];
  const docsUsed = ids.map(docById).filter((d): d is Doc => Boolean(d));
  const names = docsUsed.map((d) => pick(d.name).replace(/\.[a-z]+$/i, '')).join(', ');
  const nP = cites.length;
  const steps = [
    {
      node: (
        <>
          {t('rSearch')}{' '}
          <b>
            {DOCS.length} {t('rDocs')}
          </b>
        </>
      ),
      done: true,
    },
    {
      node: (
        <>
          {t('rRetrieved')}{' '}
          <b>
            {nP} {nP === 1 ? t('rPassage') : t('rPassages')}
          </b>
        </>
      ),
      done: true,
    },
    {
      node: (
        <>
          {t('rReading')} {names || t('rSourcesWord')}
        </>
      ),
      done: true,
    },
    { node: <>{t('rComposing')}</>, done: false },
  ];
  return (
    <div className="retrieval">
      {steps.map((s, i) => (
        <div
          key={i}
          className={'rstep' + (s.done ? ' done' : ' active')}
          style={{ '--d': i * 360 + 'ms' } as CSSProperties}
        >
          <span className="rmark">{s.done ? <Ic.check /> : <span className="rspin" />}</span>
          <span className="rtxt">{s.node}</span>
        </div>
      ))}
    </div>
  );
}

/* DocuMind - Retrieval: the "thinking" phase steps. While the backend works,
   a search step plus an active retrieving spinner; once it reports its top-k,
   the steps show the passages/documents that were ACTUALLY retrieved (with a
   composing spinner) until the answer starts streaming. */

import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePick } from '../../i18n/usePick';
import { DOCS, docById } from '../../data/sample';
import type { Doc, Retrieved } from '../../types';
import { Ic } from '../icons';

export function Retrieval({ retrieved }: { retrieved?: Retrieved[] }) {
  const { t } = useTranslation();
  const pick = usePick();

  const searchStep = {
    node: (
      <>
        {t('rSearch')}{' '}
        <b>
          {DOCS.length} {t('rDocs')}
        </b>
      </>
    ),
    done: true,
  };

  let steps: Array<{ node: ReactNode; done: boolean }>;
  if (!retrieved) {
    // Still embedding the question / ranking passages on the server.
    steps = [searchStep, { node: <>{t('rRetrieving')}</>, done: false }];
  } else {
    const ids = [...new Set(retrieved.map((r) => r.docId))];
    const docsUsed = ids.map(docById).filter((d): d is Doc => Boolean(d));
    const names = docsUsed.map((d) => pick(d.name).replace(/\.[a-z]+$/i, '')).join(', ');
    const nP = retrieved.length;
    steps = [
      searchStep,
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
  }

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

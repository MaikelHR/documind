/* DocuMind - Retrieval: the "thinking" phase steps. While the backend works,
   a search step plus an active retrieving spinner; once it reports its top-k,
   the steps show the passages/documents that were ACTUALLY retrieved (with a
   composing spinner) until the answer starts streaming. */

import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePick } from '../../i18n/usePick';
import { docById } from '../../data/sample';
import type { Doc, Retrieved } from '../../types';
import { Ic } from '../icons';

/** `docCount` is the LIVE number of indexed sidebar docs (fixed corpus +
    uploads), so the step matches what the user actually sees. */
export function Retrieval({ retrieved, docCount }: { retrieved?: Retrieved[]; docCount: number }) {
  const { t } = useTranslation();
  const pick = usePick();

  const searchStep = {
    node: (
      <>
        {t('rSearch')}{' '}
        <b>
          {docCount} {t('rDocs')}
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
    // One display name per docId: the local corpus when it knows the doc,
    // otherwise the docName the backend sent (user uploads).
    const byId = new Map<string, string>();
    for (const r of retrieved) {
      if (byId.has(r.docId)) continue;
      const doc: Doc | undefined = docById(r.docId);
      const nm = doc ? pick(doc.name) : r.docName;
      if (nm) byId.set(r.docId, nm.replace(/\.[a-z]+$/i, ''));
    }
    const names = [...byId.values()].join(', ');
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

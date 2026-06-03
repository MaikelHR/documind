/* DocuMind — `pick()`: resolve a bilingual data object ({ es, en }) into the
   active language. UI chrome goes through react-i18next's `t`; sample DATA
   (doc names, page content, snippets, seeded messages, suggestions) goes
   through `pick`, mirroring the reference `makeI18n.pick`. */

import { useTranslation } from 'react-i18next';
import type { Bilingual, Lang } from '../types';

export type PickFn = <T>(v: Bilingual<T> | T) => T;

function isBilingual(v: unknown): boolean {
  return (
    v !== null &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    ('es' in (v as object) || 'en' in (v as object))
  );
}

export function pickFor(lang: Lang): PickFn {
  return function pick<T>(v: Bilingual<T> | T): T {
    if (isBilingual(v)) {
      const b = v as Bilingual<T>;
      return b[lang] != null ? b[lang] : b.en;
    }
    return v as T;
  };
}

export function usePick(): PickFn {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language && i18n.language.startsWith('en') ? 'en' : 'es';
  return pickFor(lang);
}

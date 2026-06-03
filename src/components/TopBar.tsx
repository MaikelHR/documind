/* DocuMind - TopBar: brand, theme (direction) switch, language switch, mode toggle, avatar. */

import { useTranslation } from 'react-i18next';
import type { Direction, Lang, Mode } from '../types';
import { Ic } from './icons';
import { Logo } from './Logo';

const DIRECTIONS: { id: Direction; label: string; dot: string }[] = [
  { id: 'slate', label: 'Slate', dot: '#ff6a3d' },
  { id: 'verdigris', label: 'Verdigris', dot: '#46c98a' },
  { id: 'ember', label: 'Ember', dot: '#e58a45' },
  { id: 'cobalt', label: 'Cobalt', dot: '#5b8def' },
];
const LANGS: { id: Lang; label: string }[] = [
  { id: 'es', label: 'ES' },
  { id: 'en', label: 'EN' },
];

interface TopBarProps {
  direction: Direction;
  mode: Mode;
  lang: Lang;
  inApp: boolean;
  onDir: (d: Direction) => void;
  onMode: () => void;
  onLang: (l: Lang) => void;
  onBrand: () => void;
  onMenu: () => void;
}

export function TopBar({ direction, mode, lang, inApp, onDir, onMode, onLang, onBrand, onMenu }: TopBarProps) {
  const { t } = useTranslation();
  return (
    <header className="topbar">
      {inApp && (
        <button className="icon-btn menu-btn" onClick={onMenu} aria-label={t('sources')}>
          <Ic.menu />
        </button>
      )}
      <div className="brand" onClick={onBrand}>
        <span className="brand-mark">
          <Logo />
        </span>
        <span className="brand-name">DocuMind</span>
        <span className="brand-tag">DOCS&nbsp;AI</span>
      </div>
      <div className="topbar-spacer" />
      <div className="theme-group">
        <span className="theme-label">{t('theme')}</span>
        <div className="dir-switch" role="tablist" aria-label={t('theme')}>
          {DIRECTIONS.map((d) => (
            <button
              key={d.id}
              className={'dir-btn' + (direction === d.id ? ' active' : '')}
              onClick={() => onDir(d.id)}
              role="tab"
              aria-selected={direction === d.id}
              title={d.label}
            >
              <span className="dot" style={{ background: d.dot }} />
              <span className="label">{d.label}</span>
            </button>
          ))}
        </div>
      </div>
      <span className="topbar-div" />
      <div className="lang-switch" role="tablist" aria-label={t('langLabel')}>
        {LANGS.map((l) => (
          <button
            key={l.id}
            className={'lang-btn' + (lang === l.id ? ' active' : '')}
            onClick={() => onLang(l.id)}
            role="tab"
            aria-selected={lang === l.id}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button
        className="icon-btn"
        onClick={onMode}
        aria-label={mode === 'dark' ? t('toLight') : t('toDark')}
        title={mode === 'dark' ? t('toLight') : t('toDark')}
      >
        {mode === 'dark' ? <Ic.sun /> : <Ic.moon />}
      </button>
      <button className="avatar-chip" title="Alex Rivera - Acme Inc.">
        AR
      </button>
    </header>
  );
}

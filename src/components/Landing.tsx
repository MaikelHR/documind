/* DocuMind — Landing: marketing view (hero + product preview, how-it-works, footer). */

import { useTranslation } from 'react-i18next';
import { Ic } from './icons';
import { Logo } from './Logo';

export function Landing({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="landing scroll">
      <div className="lp-inner">
        <section className="lp-hero">
          <div className="lp-copy">
            <span className="lp-tag">{t('lpTag')}</span>
            <h1 className="lp-h1">
              {t('lpH1a')}
              <br />
              {t('lpH1b')}
              <em>{t('lpH1em')}</em>
            </h1>
            <p className="lp-sub">{t('lpSub')}</p>
            <div className="lp-actions">
              <button className="btn-primary" onClick={onOpen}>
                {t('lpOpen')} <Ic.arrow />
              </button>
              <button className="btn-ghost" onClick={onOpen}>
                <Ic.bolt /> {t('lpSee')}
              </button>
            </div>
            <div className="lp-meta">
              <div className="m">
                <b>4</b>
                <span>{t('lpM1')}</span>
              </div>
              <div className="m">
                <b>
                  &lt;800<i>ms</i>
                </b>
                <span>{t('lpM2')}</span>
              </div>
              <div className="m">
                <b>
                  100<i>%</i>
                </b>
                <span>{t('lpM3')}</span>
              </div>
            </div>
          </div>

          <div className="lp-vis">
            <div className="lp-card">
              <div className="lp-card-top">
                <span className="lp-card-mark">
                  <Ic.spark style={{ width: 13, height: 13 }} />
                </span>
                <span className="t">{t('lpCardTitle')}</span>
                <span className="lp-card-src">{t('lpCardSrc')}</span>
              </div>
              <div className="lp-card-body">
                <div className="lp-q">{t('lpQ')}</div>
                <div className="lp-retr">
                  <Ic.check style={{ width: 12, height: 12 }} /> {t('lpRetr')}
                </div>
                <div className="lp-a">
                  {t('lpAns1')}
                  <strong>$48.2M</strong>
                  {t('lpAns2')}
                  <sup className="cref">1</sup>
                  {t('lpAns3')}
                  <em>78.4%</em>.<sup className="cref">2</sup>
                </div>
                <div className="lp-mini-cite">
                  <span className="num">1</span>
                  <span className="mc-doc">{t('lpDoc')}</span>
                  <span className="mc-pg">{t('pageShort', { n: 4 })}</span>
                </div>
                <div className="lp-mini-cite">
                  <span className="num">2</span>
                  <span className="mc-doc">{t('lpDoc')}</span>
                  <span className="mc-pg">{t('pageShort', { n: 7 })}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-how">
          <div className="lp-how-head">
            <span className="eyebrow">{t('lpHowEye')}</span>
            <h2>
              {t('lpHowH1')}
              <br />
              {t('lpHowH2')}
            </h2>
          </div>
          <div className="lp-steps">
            <div className="lp-step">
              <span className="ls-num">01</span>
              <h3>{t('lpS1t')}</h3>
              <p>{t('lpS1p')}</p>
            </div>
            <div className="lp-step">
              <span className="ls-num">02</span>
              <h3>{t('lpS2t')}</h3>
              <p>{t('lpS2p')}</p>
            </div>
            <div className="lp-step">
              <span className="ls-num">03</span>
              <h3>{t('lpS3t')}</h3>
              <p>{t('lpS3p')}</p>
            </div>
          </div>
        </section>

        <footer className="lp-foot">
          <span className="lp-foot-brand">
            <span className="brand-mark sm">
              <Logo style={{ width: 13, height: 13 }} />
            </span>{' '}
            DocuMind
          </span>
          <span className="lp-foot-note">{t('lpFootNote')}</span>
        </footer>
      </div>
    </div>
  );
}

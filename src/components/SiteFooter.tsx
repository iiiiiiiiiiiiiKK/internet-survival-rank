import { ROADMAP, SITE } from '../config/site';
import { useRouter } from '../app/router';

export function SiteFooter() {
  const { navigate } = useRouter();
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <span className="brand__mark brand__mark--small" aria-hidden="true">
            ◈
          </span>
          <div>
            <div className="site-footer__title">{SITE.name}</div>
            <div className="site-footer__version">
              v{SITE.version} · 纯前端 · 无账号
            </div>
          </div>
        </div>

        <p className="site-footer__disclaimer">{SITE.disclaimer}</p>
        <p className="site-footer__privacy">{SITE.privacy}</p>

        <div className="site-footer__links">
          <button type="button" className="link-button" onClick={() => navigate('settings')}>
            数据与设置
          </button>
          <button type="button" className="link-button" onClick={() => navigate('tiers')}>
            全部段位
          </button>
          <a className="site-footer__author" href="https://x.com/0xkillcoin" target="_blank" rel="noopener noreferrer">
            作者 <span className="author-link__glyph" aria-hidden="true">𝕏</span> @0xkillcoin
          </a>
          <span className="site-footer__roadmap">
            即将支持：{ROADMAP.map((r) => `${r.name}（未上线）`).join(' · ')}
          </span>
        </div>
      </div>
    </footer>
  );
}

import { STAFF_PWA_URL } from './appBrand.js';
import { IconLoginArrow } from './LoginHero.jsx';

/** GAS ログイン画面：スタッフは Vercel でインストール */
export function StaffGasInstallCard() {
  return (
    <div className="login-card-float">
      <h2 className="login-card-title">スタッフ</h2>
      <a
        href={STAFF_PWA_URL}
        className="login-submit mt-6"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>アプリをインストール</span>
        <IconLoginArrow />
      </a>
    </div>
  );
}

import { APP_NAME } from './appBrand.js';

/** SHIFT:ONE — コロンをアクセント表示 */
export function BrandTitle({ size = 'hero' }) {
  const cls = size === 'loading'
    ? 'login-title login-title--loading'
    : size === 'hero'
      ? 'login-title'
      : 'login-title login-title--compact';
  return (
    <h1 className={cls} aria-label={APP_NAME}>
      <span className="login-title-shift">SHIFT</span>
      <span className="login-title-colon">:</span>
      <span className="login-title-one">ONE</span>
    </h1>
  );
}

export function BrandLogoMark() {
  return (
    <div className="login-logo" aria-hidden="true">
      <span className="login-logo-mark">
        S<span className="login-logo-colon">:</span>1
      </span>
    </div>
  );
}

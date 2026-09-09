/** アプリアイコン（PWA PNG） */
export function AppIconMark({ size = 'hero', className = '' }) {
  const cls = size === 'hero'
    ? `app-icon-mark app-icon-mark--hero ${className}`.trim()
    : size === 'compact'
      ? `app-icon-mark app-icon-mark--compact ${className}`.trim()
      : `app-icon-mark ${className}`.trim();

  return (
    <div className={cls}>
      <div className="app-icon-mark__glow" aria-hidden="true" />
      <img
        className="app-icon-mark__img"
        src="/icons/apple-touch-icon.png"
        width={180}
        height={180}
        alt=""
        draggable={false}
      />
    </div>
  );
}

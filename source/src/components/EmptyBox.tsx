/** Пустая открытая коробка — иллюстрация для пустых состояний (в стиле «развёртки»). */
export function EmptyBox({ className, label }: { className?: string; label?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 170" width="200" height="170" aria-hidden="true">
      <ellipse cx="100" cy="156" rx="78" ry="9" fill="rgba(70,50,20,.14)" />
      {/* задние клапаны */}
      <path d="M42 62 22 34l62-8 16 30Z" fill="#c49c6c" stroke="#9c7a52" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M158 62l20-28-62-8-16 30Z" fill="#c9a273" stroke="#9c7a52" strokeWidth="1.5" strokeLinejoin="round" />
      {/* внутренность */}
      <path d="M42 62h116l-14 22H56Z" fill="#8f6c45" />
      {/* передняя и боковые грани */}
      <path d="M42 62v74l58 14V84Z" fill="#d8b98d" stroke="#9c7a52" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M158 62v74l-58 14V84Z" fill="#c9a273" stroke="#9c7a52" strokeWidth="1.5" strokeLinejoin="round" />
      {/* передние клапаны */}
      <path d="M42 62 26 96l58 10 16-22Z" fill="#dcc19b" stroke="#9c7a52" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M158 62l16 34-58 10-16-22Z" fill="#d2b083" stroke="#9c7a52" strokeWidth="1.5" strokeLinejoin="round" />
      {/* линия высечки */}
      <path d="M52 112v18l38 9" fill="none" stroke="#9c7a52" strokeWidth="1.5" strokeDasharray="4 4" />
      {/* зелёная лента */}
      <path d="M128 70l12 2v22l-12-2Z" fill="#00671e" opacity=".9" />
      {label && (
        <text x="100" y="22" textAnchor="middle" fontFamily="Geologica Variable, sans-serif" fontWeight="800" fontSize="22" style={{ fill: 'var(--ink)' }}>
          {label}
        </text>
      )}
    </svg>
  );
}

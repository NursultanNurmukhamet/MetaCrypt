/** Inline logo mark — same artwork as the favicon, crisp at any size. */

export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="mc-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="12" fill="url(#mc-logo-g)" />
      <rect x="14" y="14" width="36" height="36" rx="7" fill="none" stroke="#fff" strokeWidth="3.5" opacity="0.9" />
      <circle cx="32" cy="29" r="5" fill="#fff" />
      <path d="M32 31 L32 41" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

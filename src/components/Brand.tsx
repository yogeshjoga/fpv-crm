/** EgireRobotics logo — inline SVG so it stays crisp and theme-aware (uses currentColor). */

export function LogoMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true" fill="none">
      {/* arms */}
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <line x1="32" y1="32" x2="14" y2="14" />
        <line x1="32" y1="32" x2="50" y2="14" />
        <line x1="32" y1="32" x2="14" y2="50" />
        <line x1="32" y1="32" x2="50" y2="50" />
      </g>
      {/* motor guards — open rings */}
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="round">
        <path d="M20 6a10 10 0 1 0 -14 14" />
        <path d="M44 6a10 10 0 1 1 14 14" />
        <path d="M20 58a10 10 0 1 1 -14 -14" />
        <path d="M44 58a10 10 0 1 0 14 -14" />
      </g>
      {/* body — 4-point curved star */}
      <path
        d="M32 16 C34 26 38 30 48 32 C38 34 34 38 32 48 C30 38 26 34 16 32 C26 30 30 26 32 16 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Logo({
  className = '',
  markSize = 30,
  showTagline = false,
  compact = false,
}: {
  className?: string;
  markSize?: number;
  showTagline?: boolean;
  compact?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={markSize} />
      {!compact && (
        <span className="leading-[0.95]">
          <span className="block font-display text-[15px] font-extrabold tracking-[0.14em] text-current">EGIRE</span>
          <span className="block font-display text-[15px] font-extrabold tracking-[0.14em] text-current">ROBOTICS</span>
          {showTagline && (
            <span className="mt-0.5 block text-[9px] font-medium tracking-[0.22em] text-current/60">
              EXPLORE · ENGINEER · EXCEL
            </span>
          )}
        </span>
      )}
    </span>
  );
}

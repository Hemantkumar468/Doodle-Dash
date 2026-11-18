export default function BrandMark({ className = '' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="doodle-mark" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop className="text-amber-300" stopColor="currentColor" />
          <stop className="text-rose-400" offset="1" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#doodle-mark)" />
      <path className="text-violet-950" d="M17 42c7-16 12-22 20-23 6-1 11 3 10 8-1 6-10 8-17 6-6-2-8-7-4-11 4-5 13-4 20 1" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path className="text-violet-950" d="m38 42 8-8 5 5-8 8-8 2 3-7Z" fill="white" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="16" cy="18" r="3" fill="white" />
    </svg>
  );
}

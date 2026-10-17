/**
 * HalalSearch brand mark — a map pin with a crescent cut-out (halal + location).
 * Mirrors the favicon in app/icon.svg so the in-app logo matches the tab icon.
 */
export default function BrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="HalalSearch"
      className={className}
    >
      <path
        fill="#059669"
        d="M32 3C19.85 3 10 12.85 10 25c0 15.9 19.9 33.8 21.1 34.7a1.5 1.5 0 0 0 1.8 0C34.1 58.8 54 40.9 54 25 54 12.85 44.15 3 32 3Z"
      />
      <circle cx="32" cy="24" r="13" fill="#ffffff" />
      <circle cx="36.5" cy="21" r="13" fill="#059669" />
    </svg>
  );
}
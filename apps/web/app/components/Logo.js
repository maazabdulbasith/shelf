export default function Logo({ size = 38, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, display: "block" }}
    >
      <defs>
        <linearGradient id="logoBg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2e2013" />
          <stop offset="50%" stopColor="#1a130c" />
          <stop offset="100%" stopColor="#0c0906" />
        </linearGradient>
        <linearGradient id="logoGold" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#b45309" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="logoRail" x1="10" y1="49" x2="54" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
          <stop offset="25%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#fef08a" />
          <stop offset="75%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.15" />
        </linearGradient>
        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Squircle base */}
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="url(#logoBg)"
        stroke="url(#logoGold)"
        strokeWidth="1.8"
      />

      {/* Back screenshot card */}
      <rect
        x="14"
        y="14"
        width="30"
        height="23"
        rx="4.5"
        fill="#f59e0b"
        fillOpacity="0.14"
        stroke="#f59e0b"
        strokeWidth="1.2"
        strokeOpacity="0.4"
      />

      {/* Front screenshot card */}
      <rect
        x="20"
        y="20"
        width="30"
        height="23"
        rx="4.5"
        fill="#140f0a"
        stroke="url(#logoGold)"
        strokeWidth="1.8"
      />

      {/* Document OCR lines */}
      <line x1="25" y1="26" x2="37" y2="26" stroke="#fde68a" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="25" y1="31" x2="45" y2="31" stroke="#fef3c7" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="25" y1="36" x2="40" y2="36" stroke="#fef3c7" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.6" />

      {/* Viewfinder target dot */}
      <circle cx="44" cy="26" r="1.6" fill="#f59e0b" />

      {/* The Shelf illuminated rail */}
      <path
        d="M10 49h44"
        stroke="#f59e0b"
        strokeWidth="4"
        strokeLinecap="round"
        strokeOpacity="0.35"
        filter="url(#logoGlow)"
      />
      <path d="M12 49h40" stroke="url(#logoRail)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 42, className = "" }) {
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
        {/* Startup Electric Purple-Cyan Gradients */}
        <linearGradient id="logoBg" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E1338" />
          <stop offset="50%" stopColor="#120D24" />
          <stop offset="100%" stopColor="#080612" />
        </linearGradient>

        <linearGradient id="logoBorder" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="45%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>

        <linearGradient id="logoCardFront" x1="18" y1="18" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1F1735" />
          <stop offset="100%" stopColor="#0C0916" />
        </linearGradient>

        <linearGradient id="logoRailGlow" x1="10" y1="49" x2="54" y2="49" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.2" />
          <stop offset="30%" stopColor="#A855F7" />
          <stop offset="50%" stopColor="#38BDF8" />
          <stop offset="70%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.2" />
        </linearGradient>

        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
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
        stroke="url(#logoBorder)"
        strokeWidth="1.8"
      />

      {/* Back card (Cyan translucent) */}
      <rect
        x="13"
        y="13"
        width="31"
        height="24"
        rx="5"
        fill="#06B6D4"
        fillOpacity="0.16"
        stroke="#06B6D4"
        strokeWidth="1.2"
        strokeOpacity="0.5"
      />

      {/* Front card (Violet glowing) */}
      <rect
        x="20"
        y="19"
        width="31"
        height="24"
        rx="5"
        fill="url(#logoCardFront)"
        stroke="#A855F7"
        strokeWidth="1.6"
      />

      {/* Document OCR lines */}
      <line x1="26" y1="26" x2="38" y2="26" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="26" y1="31" x2="46" y2="31" stroke="#E9D5FF" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.85" />
      <line x1="26" y1="36" x2="41" y2="36" stroke="#E9D5FF" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.6" />

      {/* AI Viewfinder spark dot */}
      <circle cx="45" cy="26" r="1.8" fill="#F472B6" />

      {/* The Shelf illuminated rail */}
      <path
        d="M10 50h44"
        stroke="#A855F7"
        strokeWidth="4"
        strokeLinecap="round"
        strokeOpacity="0.4"
        filter="url(#logoGlow)"
      />
      <path d="M12 50h40" stroke="url(#logoRailGlow)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

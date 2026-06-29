// PRISM mark: a white beam entering a prism and dispersing into the five
// phase colors (Plan / Research / Implement / Synthesize / Maintain). Colors
// are the web equivalents of the installer's xterm-256 palette so the web UI
// matches the terminal banner.
interface LogoProps { animated?: boolean; }
export default function Logo({ animated = false }: LogoProps) {
  return (
    <svg
      className={`logo-mark${animated ? " logo-mark-animated" : ""}`}
      viewBox="0 0 44 32"
      role="img"
      aria-label="PRISM"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* incoming white beam */}
      <line x1="0" y1="16" x2="16" y2="16" stroke="#e6edf3" strokeWidth="2.2" strokeLinecap="round" />
      {/* dispersed spectrum */}
      <line x1="24" y1="16" x2="44" y2="8" stroke="#ff5f5f" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="24" y1="16" x2="44" y2="11.5" stroke="#ffaf5f" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="24" y1="16" x2="44" y2="15" stroke="#ffd75f" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="24" y1="16" x2="44" y2="18.5" stroke="#87ff87" strokeWidth="1.9" strokeLinecap="round" />
      <line x1="24" y1="16" x2="44" y2="22" stroke="#5fafff" strokeWidth="1.9" strokeLinecap="round" />
      {/* prism */}
      <path
        d="M20 4 L9 27 L31 27 Z"
        fill="rgba(175,135,255,0.15)"
        stroke="#af87ff"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

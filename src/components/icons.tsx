import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const Icon = {
  brush: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M3 21c3 0 5-1.5 5-4a3 3 0 0 0-3-3c-2 0-2 3-2 7Z" />
      <path d="M8.5 13.5 19 3l2 2L10.5 15.5" />
    </svg>
  ),
  radar: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="M12 12 18.5 5.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  ),
  engine: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M4 10h2V8h4V6h4v2h3l2 3h2v5h-2l-2 3H8l-2-2H4Z" />
      <path d="M10 13h4" />
    </svg>
  ),
  wheel: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
    </svg>
  ),
  drop: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
      <path d="M9 14a3 3 0 0 0 3 3" />
    </svg>
  ),
  foam: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <circle cx="8" cy="14" r="4" />
      <circle cx="15" cy="10" r="5" />
      <circle cx="17" cy="18" r="2.5" />
    </svg>
  ),
  fuel: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
      <path d="M3 21h12M6 9h6" />
      <path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8l-3-3" />
    </svg>
  ),
  wrench: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4Z" />
    </svg>
  ),
  speed: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4-6" />
    </svg>
  ),
  light: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M9 6c-3 0-5 2.7-5 6s2 6 5 6h2V6Z" />
      <path d="M15 8h6M15 12h6M15 16h6" />
    </svg>
  ),
  camera: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M3 8h4l2-3h6l2 3h4v11H3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  pause: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M8 5v14M16 5v14" />
    </svg>
  ),
  play: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M7 4v16l13-8Z" fill="currentColor" />
    </svg>
  ),
  settings: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  garage: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M3 21V9l9-6 9 6v12" />
      <path d="M7 21v-8h10v8M7 16h10" />
    </svg>
  ),
  restart: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
  trophy: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  ),
  arrowUp: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M12 3 5 12h4v9h6v-9h4Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  home: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M3 11 12 3l9 8M5 9v12h14V9" />
    </svg>
  ),
  back: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M15 18 9 12l6-6" />
    </svg>
  ),
  check: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  lock: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  leaf: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M4 20c0-9 6-15 16-16-1 10-7 16-16 16Z" />
      <path d="M4 20 14 10" />
    </svg>
  ),
  pin: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}>
      <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
};

export type IconName = keyof typeof Icon;

export function UpgradeIcon({ name, size = 22 }: { name: string; size?: number }) {
  const C = (Icon as Record<string, (p: P) => React.ReactElement>)[name] ?? Icon.settings;
  return <C size={size} />;
}

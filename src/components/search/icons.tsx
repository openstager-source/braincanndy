// Line icons for the search page: 24px grid, stroke follows currentColor, hidden from screen readers.
import type { ReactNode } from "react";

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

type P = { className?: string };

export const PlusIcon = (p: P) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const ArrowIcon = (p: P) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const ChevronIcon = (p: P) => <Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>;
export const CloseIcon = (p: P) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const SearchIcon = (p: P) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>;
export const MicIcon = (p: P) => <Icon {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Icon>;
export const ShieldIcon = (p: P) => <Icon {...p}><path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></Icon>;
export const StarIcon = (p: P) => <Icon {...p}><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" /></Icon>;
export const CupIcon = (p: P) => <Icon {...p}><path d="M4 9h12v4a6 6 0 0 1-12 0V9Z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M7 3v3M10 3v3M13 3v3" /></Icon>;
export const BowlIcon = (p: P) => <Icon {...p}><path d="M3 11h18a9 9 0 0 1-18 0Z" /><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" /></Icon>;
export const TrendDownIcon = (p: P) => <Icon {...p}><path d="m3 7 6 6 4-4 8 8" /><path d="M15 17h6v-6" /></Icon>;
export const AlertIcon = (p: P) => <Icon {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></Icon>;
export const CheckIcon = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icon>;
export const GlobeIcon = (p: P) => <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></Icon>;
export const PinIcon = (p: P) => <Icon {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></Icon>;

/** Filled four-point sparkle: marks AI-written text. */
export function SparkIcon({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5c.7 5 3.5 8.6 9 9.5-5.5.9-8.3 4.5-9 9.5-.7-5-3.5-8.6-9-9.5 5.5-.9 8.3-4.5 9-9.5Z" fill="currentColor" />
    </svg>
  );
}

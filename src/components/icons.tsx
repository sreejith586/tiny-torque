// Icon set matching Varun's mockup (garage-log-147.html, D-044) — real stroke SVGs instead of
// emoji. Path data is copied directly from the mockup, not redrawn, per D-027's "compose only
// from existing prototype pieces."
import type { SVGProps } from 'react';

interface IconProps extends Omit<
  SVGProps<SVGSVGElement>,
  'viewBox' | 'fill' | 'stroke' | 'strokeWidth' | 'strokeLinecap' | 'strokeLinejoin'
> {
  size?: number;
}

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function GarageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 11L12 4l9 7" />
      <path d="M5 10v9.5a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5V10" />
      <rect x="8.5" y="13" width="7" height="7" rx="0.6" />
      <path d="M8.5 15.5h7M8.5 18h7" />
    </Base>
  );
}

export function MarketIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 9l1.4-4.2A1.5 1.5 0 0 1 5.8 4h12.4a1.5 1.5 0 0 1 1.4 1L21 9" />
      <path d="M4 9h16v9.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5V9z" />
      <path d="M9 13a2.5 2.5 0 0 0 5 0" />
    </Base>
  );
}

export function AddIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 8v8M8 12h8" />
    </Base>
  );
}

export function OffersIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M17 3l4 4-4 4" />
      <path d="M21 7H9a4 4 0 0 0-4 4v1" />
      <path d="M7 21l-4-4 4-4" />
      <path d="M3 17h12a4 4 0 0 0 4-4v-1" />
    </Base>
  );
}

export function ProfileIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </Base>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Base {...props}>
      <polygon points="3 4 21 4 14 12 14 19 10 21 10 12 3 4" />
    </Base>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 7h10M3 12h6M3 17h3" />
      <path d="M17 4v16M17 4l4 4M17 4l-4 4" />
    </Base>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Base>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="1.8" />
      <path d="M21 15l-5-5L5 21" />
    </Base>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="14" r="3.5" />
    </Base>
  );
}

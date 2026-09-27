import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn-style class merger. Only use with semantic tokens (D-027) — never raw colours. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

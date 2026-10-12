// Shown when there's no avatar photo (garage-log-147.html's getInitials, D-044): first letters of
// the first two words, or the first two letters of a single word.
export function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

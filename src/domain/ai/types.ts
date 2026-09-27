export interface ScanCandidate {
  brand: string;
  model: string | null;
  variant: string | null;
  series: string | null;
  scale: string | null;
  confidence: number; // 0-1
  notes: string | null;
}

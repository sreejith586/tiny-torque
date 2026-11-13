export interface SecurityHeaderOptions {
  supabaseUrl?: string;
  posthogHost?: string;
  dev?: boolean;
  preview?: boolean;
}
export function buildCsp(opts?: SecurityHeaderOptions): string;
export function securityHeaders(opts?: SecurityHeaderOptions): Array<{ key: string; value: string }>;

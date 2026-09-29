// Spinner + pulsing-dots loaders, ported from garage-log-147.html's .otp-status-spinner and
// .ob-loader-dots (D-044). Scoped <style> tags (not globals.css, which is protected) — safe to
// mount more than once on a page, browsers just dedupe identical rules.

export function Spinner() {
  return (
    <>
      <style>{`
        @keyframes mv-otp-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        style={{
          width: 13,
          height: 13,
          borderRadius: '50%',
          border: '2px solid color-mix(in srgb, var(--orange) 30%, transparent)',
          borderTopColor: 'var(--orange)',
          animation: 'mv-otp-spin 0.7s linear infinite',
          flexShrink: 0,
        }}
      />
    </>
  );
}

export function StatusRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: 'var(--muted)',
        marginTop: 14,
        minHeight: 18,
      }}
    >
      {children}
    </div>
  );
}

export function LoaderDots() {
  return (
    <>
      <style>{`
        @keyframes mv-ob-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 14 }}>
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--orange)',
              animation: `mv-ob-dot-pulse 1.2s ease-in-out infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

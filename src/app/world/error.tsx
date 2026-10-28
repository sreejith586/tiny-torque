'use client';

// Route-level error state for /world/* (MV-W02-01 "empty/loading/error states").
export default function WorldError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <div className="panel" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 16 }}>Your garage did not load</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
          Something went wrong on our side. Try again in a moment.
        </p>
        <button type="button" className="btn-secondary" style={{ marginTop: 14 }} onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}

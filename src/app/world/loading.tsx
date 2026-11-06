import { LoaderDots } from '@/components/Loaders';

export default function WorldLoading() {
  return (
    <main style={{ padding: '20px 16px', flex: 1 }}>
      <div className="panel" style={{ textAlign: 'center', padding: 28 }}>
        <p className="muted" style={{ fontSize: 13 }}>
          Opening your garage…
        </p>
        <LoaderDots />
      </div>
    </main>
  );
}

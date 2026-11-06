// Loading boundary only for the owner pages. Deliberately NOT at /world root: a loading.tsx there
// wraps /world/g/[handle] too, and a streamed shell is already a 200 by the time notFound() runs —
// the dark 404 for unknown/hidden garages must stay a real 404 (D-028, e2e/world.spec.ts).
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

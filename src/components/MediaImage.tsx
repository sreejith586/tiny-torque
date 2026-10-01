import type { CSSProperties } from 'react';

// D-010: the single image primitive. Renders a direct URL (`src`, e.g. a local object-URL during
// upload), or a `media` row by id via the signing route `/api/media/{id}` (private buckets → signed
// URL, scoped by RLS), or the mockup's No-Photo car-silhouette placeholder (D-045) when neither.

export function NoPhotoPlaceholder({ label = 'No Photo' }: { label?: string }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: 5,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'var(--muted)',
          opacity: 0.3,
          WebkitMaskImage: 'url(/car-placeholder.png)',
          WebkitMaskSize: 'contain',
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          maskImage: 'url(/car-placeholder.png)',
          maskSize: 'contain',
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted)',
          fontSize: 15,
          fontWeight: 600,
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function MediaImage({
  src,
  mediaId,
  alt,
  style,
}: {
  src?: string | null;
  mediaId?: string | null;
  alt: string;
  style?: CSSProperties;
}) {
  const url = src ?? (mediaId ? `/api/media/${mediaId}` : null);
  if (!url) return <NoPhotoPlaceholder />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} style={style} />;
}

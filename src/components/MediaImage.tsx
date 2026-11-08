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
          color: 'var(--cream)',
          opacity: 0.85,
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

/** Render widths the signing route accepts (MV-S9-03): a card thumbnail never needs the 1600 px
 *  original. Kept to a short list so the CDN cache hits instead of one render per random width. */
export const MEDIA_WIDTHS = [96, 240, 480, 960] as const;
export type MediaWidth = (typeof MEDIA_WIDTHS)[number];

export default function MediaImage({
  src,
  mediaId,
  alt,
  style,
  width,
  priority = false,
}: {
  src?: string | null;
  mediaId?: string | null;
  alt: string;
  style?: CSSProperties;
  /** Ask Storage for a resized render of this width (device pixels); omit for the original. */
  width?: MediaWidth;
  /** Above-the-fold hero: load eagerly. Everything else lazy-loads (MV-S9-03). */
  priority?: boolean;
}) {
  const url = src ?? (mediaId ? `/api/media/${mediaId}${width ? `?w=${width}` : ''}` : null);
  if (!url) return <NoPhotoPlaceholder />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      style={style}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
    />
  );
}

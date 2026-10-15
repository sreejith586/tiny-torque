// 5 distinct filled/empty stars (garage-log-147.html starsHtml) instead of a single "★ 4.5"
// string — same rounding (nearest whole star).
export default function StarRating({ avg }: { avg?: number | null }) {
  const rounded = Math.round(avg ?? 0);
  return (
    <span className="stars">
      {Array.from({ length: 5 }, (_, i) =>
        i < rounded ? (
          <span key={i}>★</span>
        ) : (
          <span key={i} className="empty">
            ★
          </span>
        )
      )}
    </span>
  );
}

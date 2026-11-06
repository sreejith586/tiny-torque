'use client';

// The garage scene (MV-W02-02, 07 §5.1, D-082 proposed): CSS layers for the level backdrop + the
// existing CarCard in each display slot, the featured car large on top. Re-renders from whatever
// layout it is handed, so the editor can show its optimistic state through the same component.
import type { ReactNode } from 'react';
import CarCard from '@/components/CarCard';
import type { GarageItem } from '@/domain/garage';
import type { GarageLayout, WorldLevelRow } from '@/domain/world';
import { levelBackdrop, slotCells } from './scene';
import styles from './World.module.css';

export default function GarageScene({
  name,
  level,
  score,
  capacity,
  layout,
  items,
  featuredItemId,
  themeSku,
  subtitle,
  slotFooter,
}: {
  name: string;
  level: WorldLevelRow;
  score: number;
  capacity: number;
  layout: GarageLayout;
  items: readonly GarageItem[];
  featuredItemId: string | null;
  themeSku: string | null;
  /** Visitor view: visits / kudos line under the sign (MV-W03-03). */
  subtitle?: ReactNode;
  /** Visitor view: rendered under a placed car — the "For sale" deep link (marketplace bridge). */
  slotFooter?: (item: GarageItem) => ReactNode;
}) {
  const featured = featuredItemId ? (items.find((i) => i.id === featuredItemId) ?? null) : null;
  const cells = slotCells(layout, items, capacity);

  return (
    <section
      className={styles.scene}
      data-backdrop={levelBackdrop(level.level)}
      data-theme={themeSku ?? 'none'}
      aria-label={`${name}, level ${level.level} ${level.name}`}
    >
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.sign}>
        <span className={styles.signName}>{name}</span>
        <span className="level-pill">
          Level {level.level} · {level.name}
          {score > 0 ? ` · ${score} pts` : ''}
        </span>
      </div>
      {subtitle && (
        <p className="muted" style={{ position: 'relative', fontSize: 12, margin: '-4px 0 10px' }}>
          {subtitle}
        </p>
      )}

      <div className={styles.featured}>
        <div className={styles.featuredLabel}>Featured car</div>
        {featured ? (
          <div className="garage-grid" style={{ gridTemplateColumns: '1fr' }}>
            <CarCard item={featured} view="grid" />
            {slotFooter?.(featured)}
          </div>
        ) : (
          <div className={styles.emptySlot}>Pick a featured car</div>
        )}
      </div>

      <div className={styles.slots} role="list" aria-label="Display slots">
        {cells.map((cell) => (
          <div key={cell.slot} role="listitem">
            {cell.item ? (
              <div className="garage-grid" style={{ gridTemplateColumns: '1fr' }}>
                <CarCard item={cell.item} view="grid" />
                {slotFooter?.(cell.item)}
              </div>
            ) : (
              <div className={styles.emptySlot}>Slot {cell.slot + 1}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

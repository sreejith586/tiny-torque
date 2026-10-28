'use client';

// Garage editor (MV-W02-03, D-082 proposed). Prototype pieces only: the scene above, then panels of
// native <select>s (one per display slot, one for the featured car), a settings panel (open-house
// mode, theme), and a rename form. Optimistic: the scene re-renders from local state the moment a
// select changes; Save calls the server action and rolls back to the last saved state on error.
import { useState, useTransition } from 'react';
import type { GarageItem } from '@/domain/garage';
import type { GarageLayout, OwnGarage, WorldItemRow, WorldOpenMode } from '@/domain/world';
import { WORLD_OPEN_MODES } from '@/domain/world';
import {
  renameGarageAction,
  saveLayoutAction,
  updateGarageSettingsAction,
} from '@/app/world/actions';
import GarageScene from './GarageScene';
import { placeInSlot, slotCells } from './scene';
import { OPEN_MODE_LABEL } from './copy';
import styles from './World.module.css';

export default function GarageEditor({
  own,
  items,
  themes,
  renamePrice,
}: {
  own: OwnGarage;
  items: GarageItem[];
  /** Themes the owner holds in inventory — the only ones the guard lets them apply. */
  themes: WorldItemRow[];
  renamePrice: number | null;
}) {
  const [saved, setSaved] = useState({
    layout: own.layout,
    featured: own.garage.featured_item_id,
  });
  const [layout, setLayout] = useState<GarageLayout>(own.layout);
  const [featured, setFeatured] = useState<string | null>(own.garage.featured_item_id);
  const [openMode, setOpenMode] = useState<WorldOpenMode>(own.garage.open_mode);
  const [themeId, setThemeId] = useState<string | null>(own.garage.theme_item_id);
  const [name, setName] = useState(own.garage.name);
  const [renameDraft, setRenameDraft] = useState(own.garage.name);
  const [renameCount, setRenameCount] = useState(own.garage.rename_count);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const themeSku = themeId ? (themes.find((t) => t.id === themeId)?.sku ?? null) : null;
  const cells = slotCells(layout, items, own.displayCapacity);
  const dirty =
    JSON.stringify(layout) !== JSON.stringify(saved.layout) || featured !== saved.featured;

  function flash(msg: string) {
    setError(null);
    setNotice(msg);
  }

  function saveLayout() {
    setError(null);
    startTransition(async () => {
      const [a, b] = await Promise.all([
        saveLayoutAction(layout),
        featured !== saved.featured
          ? updateGarageSettingsAction({ featuredItemId: featured })
          : Promise.resolve({ ok: true as const, data: undefined }),
      ]);
      const failed = [a, b].find((r) => !r.ok);
      if (failed && !failed.ok) {
        // rollback to the last saved state (prototype has no toast — inline error)
        setLayout(saved.layout);
        setFeatured(saved.featured);
        setError(failed.error);
        return;
      }
      setSaved({ layout, featured });
      flash('Garage saved.');
    });
  }

  function saveSettings() {
    setError(null);
    startTransition(async () => {
      const r = await updateGarageSettingsAction({ openMode, themeItemId: themeId });
      if (!r.ok) {
        setOpenMode(own.garage.open_mode);
        setThemeId(own.garage.theme_item_id);
        setError(r.error);
        return;
      }
      flash('Settings saved.');
    });
  }

  function rename() {
    setError(null);
    startTransition(async () => {
      const r = await renameGarageAction(renameDraft);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setName(r.data.name);
      setRenameDraft(r.data.name);
      setRenameCount((c) => c + 1);
      flash('Garage renamed.');
    });
  }

  return (
    <div>
      <GarageScene
        name={name}
        level={own.level}
        score={own.garage.score}
        capacity={own.displayCapacity}
        layout={layout}
        items={items}
        featuredItemId={featured}
        themeSku={themeSku}
      />

      {error && (
        <p className="field-error" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>
          {notice}
        </p>
      )}

      <div className="section-title">Display slots</div>
      <div className="panel">
        {items.length === 0 ? (
          <div className="empty-state" style={{ padding: 14 }}>
            <p>No public cars yet. Make a car public in your garage to display it here.</p>
          </div>
        ) : (
          <>
            <div className={styles.editorRow}>
              <label htmlFor="featured-select">Featured</label>
              <select
                id="featured-select"
                value={featured ?? ''}
                onChange={(e) => setFeatured(e.target.value || null)}
              >
                <option value="">— none —</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.brand} {i.model ?? ''}
                  </option>
                ))}
              </select>
            </div>
            {cells.map((cell) => (
              <div className={styles.editorRow} key={cell.slot}>
                <label htmlFor={`slot-${cell.slot}`}>Slot {cell.slot + 1}</label>
                <select
                  id={`slot-${cell.slot}`}
                  value={cell.item?.id ?? ''}
                  onChange={(e) =>
                    setLayout(placeInSlot(layout, cell.slot, e.target.value || null))
                  }
                >
                  <option value="">— empty —</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.brand} {i.model ?? ''}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {own.displayCapacity} slots at level {own.level.level}
              {own.garage.extra_slots > 0 ? ` (${own.garage.extra_slots} bought)` : ''}. Only public
              cars can be shown.
            </p>
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: 12 }}
              disabled={pending || !dirty}
              onClick={saveLayout}
            >
              {pending ? 'Saving…' : 'Save garage'}
            </button>
          </>
        )}
      </div>

      <div className="section-title">Open house</div>
      <div className="panel">
        <div className={styles.editorRow}>
          <label htmlFor="open-mode">Who can visit</label>
          <select
            id="open-mode"
            value={openMode}
            onChange={(e) => setOpenMode(e.target.value as WorldOpenMode)}
          >
            {WORLD_OPEN_MODES.map((m) => (
              <option key={m} value={m}>
                {OPEN_MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.editorRow}>
          <label htmlFor="theme-select">Theme</label>
          <select
            id="theme-select"
            value={themeId ?? ''}
            onChange={(e) => setThemeId(e.target.value || null)}
          >
            <option value="">Default</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {themes.length === 0 && (
          <p className="muted" style={{ fontSize: 12 }}>
            Themes you buy in the shop show up here.
          </p>
        )}
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 12 }}
          disabled={pending}
          onClick={saveSettings}
        >
          Save settings
        </button>
      </div>

      <div className="section-title">Garage name</div>
      <div className="panel">
        <label htmlFor="garage-name">Name</label>
        <input
          id="garage-name"
          value={renameDraft}
          maxLength={40}
          onChange={(e) => setRenameDraft(e.target.value)}
        />
        <p className="muted" style={{ fontSize: 12 }}>
          {renameCount === 0
            ? 'Your first rename is free.'
            : renamePrice
              ? `Renaming costs ${renamePrice} tokens.`
              : 'Renaming costs tokens.'}
        </p>
        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: 10 }}
          disabled={pending || renameDraft.trim() === name || !renameDraft.trim()}
          onClick={rename}
        >
          Rename
        </button>
      </div>
    </div>
  );
}

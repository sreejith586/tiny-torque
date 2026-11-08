'use client';

import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus management for the app's modal surfaces (MV-S9-04, F-17 "focus management in dialogs"):
 * while `active`, focus moves into `ref` (its first focusable control), Tab / Shift+Tab cycle
 * inside it, Escape calls `onEscape`, and on close focus returns to whatever had it before. Plain
 * DOM — no library (D-027); the dialogs themselves stay the prototype's own overlays/panels.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onEscape?: () => void
) {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusables()[0];
    (first ?? root).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const start = items[0]!;
      const end = items[items.length - 1]!;
      const current = document.activeElement;
      if (e.shiftKey && (current === start || !root.contains(current))) {
        e.preventDefault();
        end.focus();
      } else if (!e.shiftKey && (current === end || !root.contains(current))) {
        e.preventDefault();
        start.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [ref, active, onEscape]);
}

/** Escape closes a non-modal popover (filter / sort dropdowns) and hands focus back to its trigger. */
export function useEscapeToClose(
  active: boolean,
  onClose: () => void,
  returnTo?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
      returnTo?.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onClose, returnTo]);
}

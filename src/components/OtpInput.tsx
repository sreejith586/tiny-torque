'use client';

import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { otpType, otpBackspace, otpPaste } from '@/lib/otp';
import styles from './OtpInput.module.css';

// Segmented one-time-code input: `length` single-digit cells with full keyboard
// navigation — a digit auto-advances, Backspace clears and steps back, ArrowLeft/
// Right and Home/End move between cells, and pasting a code fills every cell.
// The value is a plain contiguous digit string owned by the parent.
export default function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  autoFocus = false,
  ariaLabel = 'One-time code',
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const cells = useRef<Array<HTMLInputElement | null>>([]);
  const code = value.replace(/\D/g, '').slice(0, length);

  function focusCell(i: number) {
    const el = cells.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  }

  function commit(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>, i: number) {
    if (!e.target.value.replace(/\D/g, '')) return; // deletion is handled in onKeyDown
    const next = commit(otpType(code, i, e.target.value, length));
    focusCell(Math.min(i + 1, next.length));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const { code: next, focus } = otpBackspace(code, i);
      commit(next);
      focusCell(focus);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusCell(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusCell(i + 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusCell(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusCell(code.length);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = otpPaste(e.clipboardData.getData('text'), length);
    if (!pasted) return;
    const next = commit(pasted);
    focusCell(Math.min(next.length, length - 1));
  }

  return (
    <div className={styles.row} role="group" aria-label={ariaLabel}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            cells.current[i] = el;
          }}
          className={styles.cell}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          pattern="[0-9]*"
          aria-label={`${ariaLabel} digit ${i + 1}`}
          value={code[i] ?? ''}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}

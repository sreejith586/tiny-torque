// Pure state transitions for the segmented OTP input (OtpInput.tsx). Extracted so the
// keyboard-navigation behaviour (type → advance, Backspace → clear/step back, paste → fill)
// is unit-tested without a DOM. `code` is the contiguous digit string; `index` is the cell.

/** Type a character into cell `index`: replaces when the cell is filled, appends past the end. */
export function otpType(code: string, index: number, char: string, length: number): string {
  const digit = char.replace(/\D/g, '').slice(-1);
  if (!digit) return code;
  // slice(0, index) returns the whole string when index >= length, so this appends at the end.
  return (code.slice(0, index) + digit + code.slice(index + 1)).replace(/\D/g, '').slice(0, length);
}

/** Backspace at cell `index`: clear this cell if filled, else clear the previous one and step back. */
export function otpBackspace(code: string, index: number): { code: string; focus: number } {
  if (code[index]) return { code: code.slice(0, index) + code.slice(index + 1), focus: index };
  if (index > 0) return { code: code.slice(0, index - 1) + code.slice(index), focus: index - 1 };
  return { code, focus: 0 };
}

/** Paste: keep digits only, capped at `length`. */
export function otpPaste(text: string, length: number): string {
  return text.replace(/\D/g, '').slice(0, length);
}

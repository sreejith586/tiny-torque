import { describe, it, expect } from 'vitest';
import { otpType, otpBackspace, otpPaste } from './otp';

describe('otpType', () => {
  it('appends when typing in the next empty cell', () => {
    expect(otpType('12', 2, '3', 6)).toBe('123');
  });
  it('appends when typing in a cell past the end', () => {
    expect(otpType('12', 5, '9', 6)).toBe('129');
  });
  it('replaces the digit when the cell is already filled', () => {
    expect(otpType('123', 1, '8', 6)).toBe('183');
  });
  it('keeps only the last digit on overtype and ignores non-digits', () => {
    expect(otpType('', 0, 'a7', 6)).toBe('7');
    expect(otpType('1', 1, 'x', 6)).toBe('1');
  });
  it('never exceeds length', () => {
    expect(otpType('123456', 6, '7', 6)).toBe('123456');
  });
});

describe('otpBackspace', () => {
  it('clears the current cell when filled and stays put', () => {
    expect(otpBackspace('123', 2)).toEqual({ code: '12', focus: 2 });
  });
  it('clears the previous cell and steps back when current is empty', () => {
    expect(otpBackspace('12', 2)).toEqual({ code: '1', focus: 1 });
  });
  it('does nothing at the first cell when empty', () => {
    expect(otpBackspace('', 0)).toEqual({ code: '', focus: 0 });
  });
});

describe('otpPaste', () => {
  it('keeps digits only, capped at length', () => {
    expect(otpPaste('12 34 56', 6)).toBe('123456');
    expect(otpPaste('code: 9876543', 6)).toBe('987654');
  });
});

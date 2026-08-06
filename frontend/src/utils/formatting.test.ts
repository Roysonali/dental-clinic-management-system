import { describe, it, expect } from 'vitest';
import { formatFee, formatPhone, truncate, capitalize, formatFullName, getInitials } from './formatting';

describe('formatFee', () => {
  it('formats a fee with two decimals and the given symbol', () => {
    expect(formatFee(800, '₱')).toBe('₱800.00');
    expect(formatFee(1234.5, '₱')).toBe('₱1234.50');
    expect(formatFee(0.01, '$')).toBe('$0.01');
  });

  it('formats numeric string fees (backend Decimal wire format)', () => {
    expect(formatFee('800', '₱')).toBe('₱800.00');
    expect(formatFee('800.00', '₱')).toBe('₱800.00');
    expect(formatFee('1234.5', '₱')).toBe('₱1234.50');
    expect(formatFee('0.01', '$')).toBe('$0.01');
  });

  it('returns an em-dash for nullish values', () => {
    expect(formatFee(null, '₱')).toBe('—');
    expect(formatFee(undefined, '₱')).toBe('—');
  });

  it('returns an em-dash for empty and invalid string values without throwing', () => {
    expect(formatFee('', '₱')).toBe('—');
    expect(formatFee('not-a-number', '₱')).toBe('—');
    expect(formatFee('NaN', '₱')).toBe('—');
    expect(formatFee('Infinity', '₱')).toBe('—');
  });
});

describe('getInitials', () => {
  it('derives two initials from first and last name parts', () => {
    // 'Dr.' is the first word part → 'D' + 'R'
    expect(getInitials('Dr. Jose Rizal')).toBe('DR');
    expect(getInitials('Maria Clara Santos')).toBe('MS');
  });

  it('uses the first two characters for single-word names', () => {
    expect(getInitials('Madonna')).toBe('MA');
  });

  it('returns a question mark for empty or whitespace-only input', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials('   ')).toBe('?');
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });

  it('uppercases the result', () => {
    expect(getInitials('maria clara santos')).toBe('MS');
  });
});

describe('existing formatting helpers (regression)', () => {
  it('formatPhone formats 10-digit numbers', () => {
    expect(formatPhone('0917123456')).toBe('(091) 712-3456');
    // Non-10-digit inputs are returned unchanged.
    expect(formatPhone('+639171234567')).toBe('+639171234567');
  });

  it('truncate adds an ellipsis beyond max length', () => {
    expect(truncate('Hello world', 5)).toBe('Hello…');
    expect(truncate('Hi', 5)).toBe('Hi');
  });

  it('capitalize lowercases the rest', () => {
    expect(capitalize('hELLO')).toBe('Hello');
  });

  it('formatFullName joins first and last parts', () => {
    expect(formatFullName('Jose', 'Rizal')).toBe('Jose Rizal');
    expect(formatFullName('Jose')).toBe('Jose');
  });
});

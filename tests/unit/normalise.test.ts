import { describe, expect, it } from 'vitest';
import { normalise } from '../../src/shared/normalise.ts';
import {
  bare,
  cellForms,
  cellMatches,
  displayForms,
  parseCell,
  renderForm,
  stressPositions,
} from '../../src/shared/forms.ts';

describe('normalise', () => {
  it('lowercases and trims', () => {
    expect(normalise('  Скажу ')).toBe('скажу');
  });
  it('strips apostrophe and combining acute stress marks', () => {
    expect(normalise("сказа'л")).toBe('сказал');
    expect(normalise('сказа́л')).toBe('сказал');
    expect(normalise('сказа’л')).toBe('сказал');
  });
  it('treats ё and е as equal, including decomposed ё', () => {
    expect(normalise('идём')).toBe(normalise('идем'));
    expect(normalise('идём')).toBe('идем');
    expect(normalise('ЁЛКА')).toBe('елка');
  });
  it('keeps й intact (NFC, not NFD)', () => {
    expect(normalise('й')).toBe('й');
    expect(normalise('мой')).toBe('мой');
  });
  it('collapses internal whitespace', () => {
    expect(normalise('буду   читать')).toBe('буду читать');
  });
});

describe('cells', () => {
  it('parses variants and optional variants', () => {
    expect(parseCell("до'лжной,(до'лжною)")).toEqual([
      { form: "до'лжной", optional: false },
      { form: "до'лжною", optional: true },
    ]);
    expect(cellForms('')).toEqual([]);
  });
  it('accepts any variant, including optional ones', () => {
    expect(cellMatches("уда'лось,удало'сь", 'удалось')).toBe(true);
    expect(cellMatches("до'лжной,(до'лжною)", 'должною')).toBe(true);
    expect(cellMatches("до'лжной,(до'лжною)", 'должная')).toBe(false);
  });
  it('rejects empty input', () => {
    expect(cellMatches("скажу'", '   ')).toBe(false);
  });
  it('displays only main variants', () => {
    expect(displayForms("до'лжной,(до'лжною)")).toEqual(["до'лжной"]);
    expect(displayForms('(a)')).toEqual(['a']);
  });
});

describe('renderForm', () => {
  it('renders stress as U+0301 when on', () => {
    expect(renderForm("сказа'л", true)).toBe('сказа́л');
  });
  it('strips stress when off', () => {
    expect(renderForm("сказа'л", false)).toBe('сказал');
  });
  it('omits marks on ё and one-vowel words', () => {
    expect(renderForm("бы'л", true)).toBe('был');
    expect(renderForm("идё'м", true)).toBe('идём');
  });
  it('bare() keeps ё', () => {
    expect(bare("идё'м")).toBe('идём');
  });
  it('finds stress positions', () => {
    expect(stressPositions("сказа'ть")).toEqual([4]);
    expect(stressPositions('идём')).toEqual([2]);
  });
});

/**
 * Cleaning a raw source cell into the canonical cell string (see src/shared/forms.ts).
 *  - "," and "//" separate variants (OpenRussian uses "//" for stress variants: "уда'лось//удало'сь")
 *  - "(x)" marks an optional/archaic variant
 *  - "-" in an override means "intentionally absent"
 * Anything else odd (*, single /, ?, capitals, Latin, digits, fragments ending in "-") invalidates the cell.
 */
export type CellResult = { ok: true; cell: string } | { ok: false; reason: string };

const VALID = /^[а-яё]+(?:[-'][а-яё']*)*$/;

export function cleanCell(raw: string): CellResult {
  const s = raw.trim();
  if (!s) return { ok: false, reason: 'empty form' };
  if (s.includes('*')) return { ok: false, reason: 'asterisk in form' };
  if (s.includes('?')) return { ok: false, reason: 'question mark in form' };
  const parts = s.split(/,|\/\//).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { ok: false, reason: 'empty form' };
  const out: string[] = [];
  for (const p of parts) {
    let form = p;
    let optional = false;
    const m = /^\((.+)\)$/.exec(p);
    if (m) {
      form = m[1]!.trim();
      optional = true;
    }
    if (form.includes('/')) return { ok: false, reason: 'slash in form' };
    if (/[()]/.test(form)) return { ok: false, reason: 'unbalanced parenthesis' };
    if (/[A-ZА-ЯЁ]/.test(form)) return { ok: false, reason: 'capital letter in form' };
    if (/[a-z0-9]/i.test(form)) return { ok: false, reason: 'Latin letter or digit in form' };
    if (form.endsWith('-') || form.startsWith('-')) return { ok: false, reason: 'fragment (leading/trailing hyphen)' };
    if (!VALID.test(form)) return { ok: false, reason: 'other invalid characters' };
    const v = optional ? `(${form})` : form;
    if (!out.includes(v)) out.push(v);
  }
  return { ok: true, cell: out.join(',') };
}

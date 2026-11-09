/** Overrides: a plain key fixes a spelling's first row; "bare@accented" fixes that exact row. */
import { describe, expect, it } from 'vitest';
import { applyOverrides } from '../../scripts/lib/overrides.ts';

describe('overrides', () => {
  const rows = () => [
    { bare: 'проясниться', accented: "проя'сниться", presfut_sg1: "проя'снюсь" },
    { bare: 'проясниться', accented: "проясни'ться", presfut_sg1: "проясню'сь" },
  ];
  it('a "bare@accented" key fixes that exact row only', () => {
    const out = applyOverrides(rows(), { fix: { "проясниться@проя'сниться": { accented: "проясни'ться", presfut_sg1: "проясню'сь" } } } as never, () => {});
    expect(out.map((r) => r.accented)).toEqual(["проясни'ться", "проясни'ться"]);
  });
  it('a plain key still fixes the first row with that spelling', () => {
    const out = applyOverrides(rows(), { fix: { проясниться: { presfut_sg1: 'x' } } } as never, () => {});
    expect(out.map((r) => r.presfut_sg1)).toEqual(['x', "проясню'сь"]);
  });
});

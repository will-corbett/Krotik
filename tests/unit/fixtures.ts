import { readFileSync } from 'node:fs';
import type { AdjRow, MotionData, NounRow, VerbRow } from '../../src/shared/types.ts';
import { toVerb } from '../../src/lib/data.ts';
import type { Adjective, Noun, Verb } from '../../src/lib/types.ts';

const json = <T>(f: string): T => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as T;

export const verbs: Verb[] = json<VerbRow[]>('verbs.b0.json').map((r) => toVerb(r, 0));
export const adjectives: Adjective[] = json<AdjRow[]>('adjectives.b0.json').map(([id, accented, gloss, cells]) => ({ id, accented, gloss, cells, band: 0 }));
export const nouns: Noun[] = json<NounRow[]>('nouns.b0.json').map(([id, accented, gloss, gender, animate, sgOnly, cells]) => ({
  id, accented, gloss, gender, animate: animate === 1, sgOnly: sgOnly === 1, cells, band: 0,
}));
export const motion = json<MotionData>('motion.json');

export const verb = (bare: string) => verbs.find((v) => v.accented.replace(/'/g, '') === bare)!;
export const adjective = (bare: string) => adjectives.find((a) => a.accented.replace(/'/g, '') === bare)!;
export const noun = (bare: string) => nouns.find((n) => n.accented.replace(/'/g, '') === bare)!;

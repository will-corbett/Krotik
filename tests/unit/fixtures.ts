import { readFileSync } from 'node:fs';
import type { AdjRow, MotionData, NounRow, VerbRow } from '../../src/shared/types.ts';
import { toAdjective, toNoun, toVerb } from '../../src/lib/data.ts';
import type { Adjective, Noun, Verb } from '../../src/lib/types.ts';

const json = <T>(f: string): T => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as T;

export const verbs: Verb[] = json<VerbRow[]>('verbs.b0.json').map((r) => toVerb(r, 0));
export const adjectives: Adjective[] = json<AdjRow[]>('adjectives.b0.json').map((r) => toAdjective(r, 0));
export const nouns: Noun[] = json<NounRow[]>('nouns.b0.json').map((r) => toNoun(r, 0));
/** Bands 0–1 (top 1,000), for tests needing less common words. */
export const verbs1000: Verb[] = [...verbs, ...json<VerbRow[]>('verbs.b1.json').map((r) => toVerb(r, 1))];
export const adjectives1000: Adjective[] = [...adjectives, ...json<AdjRow[]>('adjectives.b1.json').map((r) => toAdjective(r, 1))];
export const motion = json<MotionData>('motion.json');

export const verb = (bare: string) => verbs.find((v) => v.accented.replace(/'/g, '') === bare)!;
export const adjective = (bare: string) => adjectives.find((a) => a.accented.replace(/'/g, '') === bare)!;
export const noun = (bare: string) => nouns.find((n) => n.accented.replace(/'/g, '') === bare)!;

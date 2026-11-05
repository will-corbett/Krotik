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

import type { DiminutiveRow, NumeralRow, ParticipleRow } from '../../src/shared/types.ts';
export const participles: { row: ParticipleRow; band: number }[] = [0, 1].flatMap((b) => json<ParticipleRow[]>(`participles.b${b}.json`).map((row) => ({ row, band: b })));
export const participle = (bare: string) => participles.find((p) => p.row[1].replace(/'/g, '') === bare)!;
export const numerals = json<NumeralRow[]>('numerals.json');
export const numeral = (bare: string) => numerals.find((r) => r[0].replace(/'/g, '') === bare)!;
export const diminutives = [0, 1].flatMap((b) => json<DiminutiveRow[]>(`diminutives.b${b}.json`));
export const nouns1000: Noun[] = [...nouns, ...json<NounRow[]>('nouns.b1.json').map((r) => toNoun(r, 1))];

import type { PronounData } from '../../src/shared/types.ts';
export const pronouns = json<PronounData>('pronouns.json');

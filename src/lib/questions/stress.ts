import { VERB_CELLS } from '../../shared/cells.ts';
import { bare, parseCell, stressPositions, vowelCount } from '../../shared/forms.ts';
import { pick, type Rng } from '../rng.ts';
import { TERMS, type TaskPart } from '../terms.ts';
import type { Adjective, Noun, Question, StressSettings, Verb } from '../types.ts';
import { verbCellLabel } from '../labels.ts';
import { nounCellLabel } from './plurals.ts';
import { NOUN_CELLS } from '../../shared/cells.ts';

/**
 * Stress drill: tap the stressed vowel. Only forms with a stress mark, two or more vowels and no ё
 * (ё is always stressed). Where variants differ only in stress (тво'рог / творо'г), either position counts.
 */
export function stressQuestion(form: string, cellVariants: string[], gloss: string, label: TaskPart[], key: string): Question | null {
  const word = bare(form);
  if (/ё/i.test(word) || vowelCount(word) < 2 || !form.includes("'")) return null;
  const same = cellVariants.filter((v) => bare(v) === word && v.includes("'"));
  const positions = [...new Set(same.flatMap((v) => stressPositions(v)))].sort((a, b) => a - b);
  if (!positions.length || stressPositions(form).length !== 1) return null;
  return {
    key,
    mode: 'stress',
    headword: gloss || ' ',
    headwordIsEnglish: true,
    gloss: '',
    task: [TERMS.stress, ...label],
    answer: positions.join(','),
    display: same.join(','),
    others: [],
    label: `${TERMS.stress.en} (${TERMS.stress.ru}): ${word}`,
    stress: { word, positions },
    speak: () => word,
  };
}

type Source = { kind: 'verb'; v: Verb } | { kind: 'noun'; n: Noun } | { kind: 'adj'; a: Adjective };

export function generateStressQuestions(pools: { verbs: Verb[]; nouns: Noun[]; adjectives: Adjective[] }, s: StressSettings, n: number, rng: Rng): Question[] {
  const sources: Source[][] = [];
  if (s.sources.includes('verbs')) sources.push(pools.verbs.map((v) => ({ kind: 'verb', v })));
  if (s.sources.includes('nouns')) sources.push(pools.nouns.map((x) => ({ kind: 'noun', n: x })));
  if (s.sources.includes('adjectives')) sources.push(pools.adjectives.map((a) => ({ kind: 'adj', a })));
  const out: Question[] = [];
  const keys = new Set<string>();
  const nonEmpty = sources.filter((x) => x.length);
  let guard = 0;
  while (out.length < n && nonEmpty.length && guard++ < n * 200) {
    const src = pick(rng, pick(rng, nonEmpty));
    let form = '';
    let variants: string[] = [];
    let gloss = '';
    let label: TaskPart[] = [];
    let id = '';
    if (src.kind === 'verb') {
      gloss = src.v.gloss;
      id = `v${src.v.id}`;
      if (s.forms === 'headword' || rng() < 0.3) [form, variants] = [src.v.accented, [src.v.accented]];
      else {
        const i = Math.floor(rng() * VERB_CELLS.length);
        variants = parseCell(src.v.cells[i] ?? '').map((x) => x.form);
        form = variants[0] ?? '';
        label = [{ en: verbCellLabel(i, src.v.aspect) }];
        id += `:${i}`;
      }
    } else if (src.kind === 'noun') {
      gloss = src.n.gloss;
      id = `n${src.n.id}`;
      if (s.forms === 'headword' || rng() < 0.3) [form, variants] = [src.n.accented, [src.n.accented]];
      else {
        const i = Math.floor(rng() * NOUN_CELLS.length);
        variants = parseCell(src.n.cells[i] ?? '').map((x) => x.form);
        form = variants[0] ?? '';
        label = [{ en: nounCellLabel(NOUN_CELLS[i]!) }];
        id += `:${i}`;
      }
    } else {
      gloss = src.a.gloss;
      id = `a${src.a.id}`;
      // Adjectives: the dictionary form, or a short form where stress often moves (молода').
      const short = src.a.extra.slice(0, 4).filter(Boolean);
      if (s.forms === 'headword' || !short.length || rng() < 0.4) [form, variants] = [src.a.accented, [src.a.accented]];
      else {
        const i = Math.floor(rng() * short.length);
        variants = parseCell(short[i]!).map((x) => x.form);
        form = variants[0] ?? '';
        label = [{ en: `${TERMS.shortForm.en}`, ru: TERMS.shortForm.ru }];
        id += `:s${i}`;
      }
    }
    const q = form ? stressQuestion(form, variants, gloss, label, `st:${id}`) : null;
    if (!q || keys.has(q.key)) continue;
    keys.add(q.key);
    out.push(q);
  }
  return out;
}

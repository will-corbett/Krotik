/**
 * Listening drills (critique batch 3), from the recordings actually published:
 *  - sentences: every recorded sentence, with its English (listen and choose, dictation);
 *  - endings: a recorded sentence with one noun or adjective gapped, and other real forms of that word as options
 *    ("which ending did you hear?"). Options are only forms that sound different from the answer: unstressed е/и/я
 *    (книге / книги) and о/а are alike to the ear, so a form that reduces to the same sounds isn't offered;
 *  - minimal pairs: two recorded words that differ only in a soft sign at the end (брат / брать), ы / и (был / бил)
 *    or ш / щ. The rule only pairs real, recorded words; it never makes a form.
 */
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ListeningData, PairType } from '../../src/shared/types.ts';
import type { Report } from './report.ts';
import { formLabels } from './literature.ts';

const R = 'Listening';
const TOKEN = /[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g;
const VOWELS = 'аеёиоуыэюя';
const VOICED: Record<string, string> = { б: 'п', в: 'ф', г: 'к', д: 'т', ж: 'ш', з: 'с' };

/**
 * A rough sound key, only to tell whether two forms of a word could sound alike: unstressed о → а; unstressed е, я, э,
 * ы → и; a voiced consonant at the end is devoiced. (Stress: the vowel before an apostrophe, or ё, or the only vowel.)
 */
export function soundKey(accented: string): string {
  const s = accented.toLowerCase().normalize('NFC').replace(/́/g, "'");
  const chars = [...s.replace(/'/g, '')];
  let stressed = -1;
  let k = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "'") {
      stressed = k - 1;
      continue;
    }
    k++;
  }
  if (stressed < 0) stressed = chars.indexOf('ё');
  const vowelIdx = chars.flatMap((c, i) => (VOWELS.includes(c) ? [i] : []));
  if (stressed < 0 && vowelIdx.length === 1) stressed = vowelIdx[0]!;
  const out = chars.map((c, i) => {
    if (i === stressed || !VOWELS.includes(c)) return c === 'ё' ? 'о' : c;
    return c === 'о' ? 'а' : 'еяэы'.includes(c) ? 'и' : c;
  });
  const last = out.length - 1;
  if (VOICED[out[last]!]) out[last] = VOICED[out[last]!]!;
  return out.join('');
}

const commonPrefix = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
};

interface Lemma {
  cells: string[];
}

export function buildListening(inp: {
  /** recorded sentences: rid, Russian, English */
  sentences: { rid: number; ru: string; en: string }[];
  owners: Map<string, Set<string>>;
  /** `${form}|${owner}` → which cells that spelling is (to name the form heard) */
  masks?: Map<string, number>;
  noun: (id: number) => Lemma | undefined;
  adjective: (id: number) => Lemma | undefined;
  /** recorded words: key, accented */
  words: { key: string; accented: string }[];
  report: Report;
}): ListeningData {
  const out: ListeningData = { sentences: inp.sentences.map((s) => [s.rid, s.ru, s.en]), endings: [], pairs: [] };

  for (const s of inp.sentences) {
    let best: [number, number, number, string[], string?] | null = null;
    for (const m of s.ru.matchAll(TOKEN)) {
      const token = m[0];
      const norm = normalise(token);
      const owners = inp.owners.get(norm);
      if (!owners || owners.size !== 1) continue;
      const [type, id] = [...owners][0]!.split(':') as [string, string];
      const lemma = type === 'nouns' ? inp.noun(Number(id)) : type === 'adjectives' ? inp.adjective(Number(id)) : undefined;
      if (!lemma) continue;
      const forms = lemma.cells.flatMap((c) => (c ? cellForms(c) : []));
      // The answer's stress: every spelling of it in the table must have the same stress, or it's left out.
      const answerStress = [...new Set(forms.filter((f) => normalise(f) === norm))];
      if (answerStress.length !== 1) continue;
      const answerKey = soundKey(answerStress[0]!);
      const byNorm = new Map<string, string[]>();
      for (const f of forms) byNorm.set(normalise(f), [...(byNorm.get(normalise(f)) ?? []), f]);
      const keys = new Set([answerKey]);
      const options: string[] = [];
      const candidates = [...byNorm]
        .filter(([n, fs]) => n !== norm && new Set(fs).size === 1 && commonPrefix(n, norm) >= Math.max(2, Math.min(n.length, norm.length) - 3))
        .sort(([a], [b]) => Math.abs(a.length - norm.length) - Math.abs(b.length - norm.length) || (a < b ? -1 : a > b ? 1 : 0));
      for (const [n, [f]] of candidates) {
        const k = soundKey(f!);
        if (keys.has(k)) continue;
        keys.add(k);
        // Spelt as written (no stress marks), with a capital if the sentence's word has one.
        const plain = f!.replace(/'/g, '');
        options.push(token[0] !== token[0]!.toLowerCase() ? plain[0]!.toUpperCase() + plain.slice(1) : plain);
        if (options.length === 3) break;
      }
      if (options.length < 2) continue;
      const start = m.index!;
      // Which form it is ("accusative singular"), for the explanation after answering.
      const label = [...new Set(formLabels(type, inp.masks?.get(`${norm}|${type}:${id}`) ?? 0))].join(' / ');
      if (!best || options.length >= best[3].length) best = [s.rid, start, start + token.length, [token, ...options].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), ...(label ? [label] : [])] as [number, number, number, string[], string?];
    }
    if (best) out.endings.push(best);
  }
  inp.report.count(R, 'recorded sentences (listen and choose, dictation)', out.sentences.length);
  inp.report.count(R, '"which ending did you hear?" items', out.endings.length);

  out.pairs = findPairs(inp.words);
  for (const t of ['soft', 'yi', 'shsch'] as const) inp.report.count(R, `minimal pairs: ${t}`, out.pairs.filter((p) => p[0] === t).length);
  if (out.pairs.length) inp.report.anomaly(R, 'minimal pairs (check they are real contrasts)', out.pairs.map((p) => `${p[2]} / ${p[4]}`).join(', '));
  return out;
}

/** Minimal pairs among words (same stress; the first key for each spelling). */
export function findPairs(words: { key: string; accented: string }[]): ListeningData['pairs'] {
  const pairs: ListeningData['pairs'] = [];
  const byForm = new Map<string, string>();
  for (const w of words) if (!byForm.has(w.accented)) byForm.set(w.accented, w.key);
  const seen = new Set<string>();
  const add = (type: PairType, a: string, b: string) => {
    const id = [a, b].sort().join('|');
    if (seen.has(id)) return;
    seen.add(id);
    pairs.push([type, byForm.get(a)!, a, byForm.get(b)!, b]);
  };
  const forms = [...byForm.keys()].sort();
  const set = new Set(forms);
  for (const a of forms) {
    if (set.has(a + 'ь')) add('soft', a, a + 'ь');
    for (let i = 0; i < a.length; i++) {
      const swap = (from: string, to: string, type: PairType) => {
        if (a[i] !== from) return;
        const b = a.slice(0, i) + to + a.slice(i + 1);
        if (set.has(b)) add(type, a, b);
      };
      // After ж, ш, ц an и is said as ы anyway: no contrast there.
      if (!'жшц'.includes(a[i - 1] ?? '')) swap('ы', 'и', 'yi');
      swap('ш', 'щ', 'shsch');
    }
  }
  return pairs;
}

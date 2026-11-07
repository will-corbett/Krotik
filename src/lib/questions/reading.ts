/**
 * Read and fill in: one gap at a time in a passage of public-domain literature (reading.json). A round reads on
 * through the work from a random passage, so the gaps follow the story or the scene in order.
 */
import type { ReadingData } from '../../shared/types.ts';
import type { Rng } from '../rng.ts';
import { TERMS } from '../terms.ts';
import type { Question, ReadingSettings } from '../types.ts';

const TASK = { v: TERMS.readVerb, n: TERMS.readNoun, a: TERMS.readAdj } as const;

export function generateReadingQuestions(data: ReadingData, s: ReadingSettings, n: number, rng: Rng): Question[] {
  const passages = data.passages.map((p, i) => ({ p, i })).filter(({ p }) => s.works.includes(data.works[p.w]!.kind));
  const gaps = passages.flatMap(({ p, i }) => p.gaps.map((g, gi) => ({ p, i, g, gi }))).filter(({ g }) => s.kinds.includes(g[3]));
  if (!gaps.length) return [];
  // Start at the beginning of a random passage and read on (wrapping round), taking n gaps.
  const starts = gaps.map((x, k) => (k === 0 || gaps[k - 1]!.i !== x.i ? k : -1)).filter((k) => k >= 0);
  const from = starts[Math.floor(rng() * starts.length)]!;
  const out: Question[] = [];
  for (let k = 0; k < Math.min(n, gaps.length); k++) {
    const { p, i, g, gi } = gaps[(from + k) % gaps.length]!;
    const [line, start, end, kind, hint, gloss] = g;
    const work = data.works[p.w]!;
    const answer = p.lines[line]![1].slice(start, end);
    out.push({
      key: `rd:${i}:${gi}`,
      mode: 'reading',
      headword: hint,
      gloss,
      task: [TASK[kind]],
      answer,
      others: [],
      label: TASK[kind].en,
      speak: () => p.lines[line]![1],
      passage: {
        lines: p.lines,
        line,
        start,
        end,
        credit:
          work.kind === 'stories'
            ? `${work.author}, «${p.s}», from «${work.title}» (${work.year})`
            : `${work.author}, «${work.title}» (${work.year}), ${p.s.toLowerCase()}`,
        source: work.source,
      },
    });
  }
  return out;
}

/**
 * Grammar test stage 2 (typed answers) is off the site until a native speaker has reviewed its questions
 * (STAGE2_PUBLISHED in src/lib/levelTest.ts). This writes the list to review, reports/grammar-test-stage2-for-review.md:
 * the first PER_SLOT typed questions (word in brackets) of every question type at every level, from
 * public/data/level-test.json (run after a data build). Usage: npm run review:stage2
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { topicById } from '../src/lib/topics.ts';
import { renderForm } from '../src/shared/forms.ts';
import type { LevelTestData } from '../src/shared/types.ts';

const PER_SLOT = 4;
const OUT = 'reports/grammar-test-stage2-for-review.md';
const data = JSON.parse(readFileSync('public/data/level-test.json', 'utf8')) as LevelTestData;
const ru = (s: string) => renderForm(s, true);
const cell = (s: string) => s.replace(/\|/g, '\\|');

const out: string[] = [
  '# Grammar test, stage 2: questions for review',
  '',
  'Stage 2 of the Grammar test asks the learner to **type** the right form of a word given in brackets. It is off the',
  'site until these questions have been checked. Each sentence is a real one from Tatoeba with one word taken out; the',
  'learner sees the sentence with the gap, the dictionary form in brackets and the English.',
  '',
  'For each question, please check:',
  '',
  '1. **Are the accepted answers right?** Where a question has more than one, each of them should be right.',
  '2. **Is any other form of the word also right here?** The word in brackets doesn\'t always decide the form: after',
  '   я or ты a past verb can be either gender (я хоте́л / я хоте́ла бы), and English "you" can be ты or вы (не слу́шай /',
  '   не слу́шайте). We have added every other form we think fits both the sentence and the English (so "I\'ll find"',
  '   accepts найду́ only, not нашёл); please write any we missed, or any you think should not be accepted.',
  '3. **Is the sentence natural, and is the English a fair translation?** If not, write "remove".',
  '',
  'In the last column, write **OK**, the other right forms, a correction, or **remove**. Stress is marked with ´.',
  '',
];

let n = 0;
/** Question number → its key (test type, Tatoeba id, form), so the reviewer's verdicts can be matched up later. */
const keys: Record<number, string> = {};
for (const level of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
  out.push(`## ${level}`, '');
  for (const slot of data.slots.filter((s) => s.level === level)) {
    const items = slot.items.filter((c) => c[5]).slice(0, PER_SLOT);
    if (!items.length) continue;
    const topic = topicById(slot.topic)?.title.en ?? slot.topic;
    out.push(`### ${topic}`, '', '| # | Sentence | Word given | Accepted answers | English | OK / also right / correction / remove |', '|---:|---|---|---|---|---|');
    for (const [key, text, en, start, end, hint, right, , , , , , , also = []] of items) {
      n++;
      const gap = `${text.slice(0, start)}___${text.slice(end)}`;
      out.push(`| ${n} | ${cell(gap)} | ${ru(hint)} | ${[right, ...also].map(ru).join(' **or** ')} | ${cell(en)} |  |`);
      keys[n] = key;
    }
    out.push('');
  }
}
out.push(
  '## Sources',
  '',
  `${n} questions: the first ${PER_SLOT} of each question type at each level; ${Object.values(data.slots).flatMap((s) => s.items).filter((c) => c[5] && c[13]?.length).length} accept more than one answer. Sentences and English from Tatoeba`,
  '(tatoeba.org, CC BY 2.0 FR); forms from OpenRussian.org and Wiktionary (CC BY-SA 4.0).',
  '',
);
writeFileSync(OUT, out.join('\n'));
writeFileSync(OUT.replace(/\.md$/, '.keys.json'), `${JSON.stringify(keys, null, 1)}\n`);
console.log(`${OUT}: ${n} questions`);

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
  '1. **Is our answer right?**',
  '2. **Would another form of the word also be right here?** This is the main problem we know of: the word in',
  '   brackets doesn\'t always decide the form. For example *Я ___ (хотеть) бы* could be хоте́л or хоте́ла; *Она его',
  '   ___ (бросить)* could be бро́сила or бро́сит; *Мы вытерли ___ (лицо)* could be лицо́ or ли́ца. Please write every',
  '   other form that would also be right.',
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
    out.push(`### ${topic}`, '', '| # | Sentence | Word given | Our answer | English | OK / also right / correction / remove |', '|---:|---|---|---|---|---|');
    for (const [key, text, en, start, end, hint, right] of items) {
      n++;
      const gap = `${text.slice(0, start)}___${text.slice(end)}`;
      out.push(`| ${n} | ${cell(gap)} | ${ru(hint)} | ${ru(right)} | ${cell(en)} |  |`);
      keys[n] = key;
    }
    out.push('');
  }
}
out.push(
  '## Sources',
  '',
  `${n} questions: the first ${PER_SLOT} of each question type at each level. Sentences and English from Tatoeba`,
  '(tatoeba.org, CC BY 2.0 FR); forms from OpenRussian.org and Wiktionary (CC BY-SA 4.0).',
  '',
);
writeFileSync(OUT, out.join('\n'));
writeFileSync(OUT.replace(/\.md$/, '.keys.json'), `${JSON.stringify(keys, null, 1)}\n`);
console.log(`${OUT}: ${n} questions`);

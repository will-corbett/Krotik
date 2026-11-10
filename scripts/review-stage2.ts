/**
 * Grammar test stage 2 (typed answers) is off the site until a native speaker has reviewed its questions
 * (STAGE2_PUBLISHED in src/lib/levelTest.ts). This writes the list to review, reports/grammar-test-stage2-for-review.md,
 * from the fixed questions in curated/stage2-questions.yaml (numbered in that file's order, so the reviewer's numbers
 * always point at the same question). Usage: npm run review:stage2
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { topicById } from '../src/lib/topics.ts';
import { renderForm } from '../src/shared/forms.ts';

type Q = { key: string; level: string; topic: string; ru: string; gap: [number, number]; en: string; word: string; answers: string[] };
const { questions } = parse(readFileSync('curated/stage2-questions.yaml', 'utf8')) as { questions: Q[] };
const OUT = 'reports/grammar-test-stage2-for-review.md';
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
  "2. **Is any other form of the word also right here?** The word in brackets doesn't always decide the form: after",
  '   я or ты a past verb can be either gender (я хоте́л / я хоте́ла бы), and English "you" can be ты or вы (не слу́шай /',
  "   не слу́шайте). We have added every other form we think fits both the sentence and the English (so \"I'll find\"",
  '   accepts найду́ only, not нашёл); please write any we missed, or any you think should not be accepted.',
  '3. **Is the sentence natural, and is the English a fair translation?** If not, write "remove".',
  '',
  'In the last column, write **OK**, the other right forms, a correction, or **remove**. Stress is marked with ´.',
  '',
];

let level = '';
let topic = '';
questions.forEach((q, i) => {
  if (q.level !== level) {
    if (i) out.push('');
    out.push(`## ${q.level}`, '');
    level = q.level;
    topic = '';
  }
  if (q.topic !== topic) {
    if (topic) out.push('');
    out.push(`### ${topicById(q.topic)?.title.en ?? q.topic}`, '', '| # | Sentence | Word given | Accepted answers | English | OK / also right / correction / remove |', '|---:|---|---|---|---|---|');
    topic = q.topic;
  }
  const gap = `${q.ru.slice(0, q.gap[0])}___${q.ru.slice(q.gap[1])}`;
  out.push(`| ${i + 1} | ${cell(gap)} | ${ru(q.word)} | ${q.answers.map(ru).join(' **or** ')} | ${cell(q.en)} |  |`);
});
out.push(
  '',
  '## Sources',
  '',
  `${questions.length} questions; ${questions.filter((q) => q.answers.length > 1).length} accept more than one answer. Sentences and English from Tatoeba`,
  '(tatoeba.org, CC BY 2.0 FR); forms from OpenRussian.org and Wiktionary (CC BY-SA 4.0).',
  '',
);
writeFileSync(OUT, out.join('\n'));
console.log(`${OUT}: ${questions.length} questions`);

/**
 * After `vite build`: write a real HTML file for every page (dist/learn/aspect/index.html …), each with its own title,
 * description and canonical address, and the page's text in plain HTML, so search engines (and anyone without
 * JavaScript) can read it. The app replaces this content when it starts. Also writes sitemap.xml and 404.html.
 * Interactive pages (drills) get a short description and `noindex`. Deterministic: same input, same files.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import { parseMarkdown, type Block, type Inline } from '../src/lib/markdown.ts';
import { pickExamples } from '../src/lib/learnData.ts';
import { pageTitle } from '../src/lib/pageMeta.ts';
import { href, pathOf, type Route } from '../src/lib/router.ts';
import { ALL_TOPICS, isDrill, neighbours, topicById, TOPIC_GROUPS } from '../src/lib/topics.ts';
import { renderForm } from '../src/shared/forms.ts';
import { SITE_URL } from '../src/shared/site.ts';
import type { ClozeRow, LearnExtras, ReadingIndex, ReadingUnit, ThemeData, ThemeIndex } from '../src/shared/types.ts';

const DIST = 'dist';
const template = readFileSync(join(DIST, 'index.html'), 'utf8');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = <T>(f: string) => JSON.parse(readFileSync(join(DIST, 'data', f), 'utf8')) as T;
const extras = json<LearnExtras>('learn.json');

const learnIds = new Set(readdirSync('content/learn').filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')));
interface Note { id: string; title: string; ru: string; blurb: string; parent?: string }
const notes = parse(readFileSync('content/culture/notes.yaml', 'utf8')) as Note[];
interface Link { title: string; url: string; type: string; about: string; note?: string }
const links = parse(readFileSync('content/culture/links.yaml', 'utf8')) as Link[];

// ---- Markdown blocks as HTML
const linkTarget = (h: string) => {
  const [kind, id] = h.split(':') as [string, string];
  return kind === 'note' ? href({ page: 'culture', note: id }) : kind === 'learn' ? href({ page: 'learn', topic: id }) : kind === 'reading' ? href({ page: 'reading', text: id }) : h;
};
const inline = (parts: Inline[]) =>
  parts
    .map((p) =>
      p.href
        ? `<a href="${esc(linkTarget(p.href))}"${/^https?:/.test(p.href) ? ' rel="noopener"' : ''}>${esc(p.text)}</a>`
        : p.bold ? `<strong>${esc(p.text)}</strong>` : p.italic ? `<em>${esc(p.text)}</em>` : p.code ? `<code>${esc(p.text)}</code>` : esc(p.text),
    )
    .join('');
const plain = (parts: Inline[]) => parts.map((p) => p.text).join('');

function sentence(id: number, ru: string, en: string, start = 0, end = 0): string {
  const text = end > start ? `${esc(ru.slice(0, start))}<mark>${esc(ru.slice(start, end))}</mark>${esc(ru.slice(end))}` : esc(ru);
  return `<figure><blockquote lang="ru">${text}</blockquote><figcaption>${esc(en)} <a href="https://tatoeba.org/en/sentences/show/${id}" rel="noopener">Tatoeba #${id}</a></figcaption></figure>`;
}

function block(b: Block): string {
  switch (b.type) {
    case 'heading':
      return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
    case 'para':
      return `<p>${inline(b.text)}</p>`;
    case 'tip':
      return `<aside><p>${inline(b.text)}</p></aside>`;
    case 'list': {
      const tag = b.ordered ? 'ol' : 'ul';
      return `<${tag}>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${tag}>`;
    }
    case 'table':
      return `<table><thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${b.rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`;
    case 'data':
      if (b.kind === 'tatoeba') {
        return b.items
          .map(({ id, mark }) => {
            const s = extras.sentences[id];
            if (!s) return '';
            const m = mark ? [...s[0].matchAll(/[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*/g)].find((x) => x[0].toLowerCase() === mark.toLowerCase()) : undefined;
            return sentence(Number(id), s[0], s[1], m?.index ?? 0, m ? m.index! + m[0].length : 0);
          })
          .join('');
      }
      if (b.kind === 'ipa') {
        return `<table><thead><tr><th>Word</th><th>Pronunciation (IPA)</th></tr></thead><tbody>${b.words
          .map((w) => extras.ipa[w])
          .filter((p): p is [string, string] => !!p)
          .map(([word, ipa]) => `<tr><td lang="ru">${esc(renderForm(word, true))}</td><td>${esc(ipa)}</td></tr>`)
          .join('')}</tbody></table>`;
      }
      if (b.kind === 'examples') {
        const rows = json<ClozeRow[]>(`cloze.${b.topic}.json`).filter((r) => r[7] === b.item);
        return pickExamples(rows, b.count).map(([id, ru, en, , s, e]) => sentence(id, ru, en, s, e)).join('');
      }
      // Tables of forms, single sentences and quick checks are drawn by the app from the data.
      return '';
  }
}
const markdown = (src: string) => parseMarkdown(src).map(block).join('\n');
/** The first paragraph as a search description (about 155 characters, cut at a word). */
function summary(src: string): string {
  const first = parseMarkdown(src).find((b): b is Extract<Block, { type: 'para' }> => b.type === 'para');
  const text = first ? plain(first.text).replace(/\s+/g, ' ').trim() : '';
  return text.length <= 158 ? text : `${text.slice(0, 155).replace(/\s+\S*$/, '')}…`;
}

// ---- pages
interface Page { route: Route; description: string; body: string; index: boolean }
const a = (route: Route, text: string) => `<a href="${href(route)}">${esc(text)}</a>`;
const nav = `<nav aria-label="Main"><ul>${(
  [
    [{ page: 'home' }, 'Dashboard'],
    [{ page: 'test' }, 'Grammar test'],
    [{ page: 'learn' }, 'Learn'],
    [{ page: 'words' }, 'Words'],
    [{ page: 'drill' }, 'Drill'],
    [{ page: 'reading' }, 'Reading'],
    [{ page: 'culture' }, 'Culture'],
  ] as [Route, string][]
)
  .map(([r, t]) => `<li>${a(r, t)}</li>`)
  .join('')}</ul></nav>`;
// The same credits as the app's footer: the pages quote CC BY-SA and CC BY material, so they carry the attribution.
const footer = `<footer><p>${a({ page: 'about' }, 'About & sources')} · Data: <a href="https://en.openrussian.org" rel="noopener">OpenRussian.org</a> (CC BY-SA 4.0) · <a href="https://en.wiktionary.org" rel="noopener">Wiktionary</a> via kaikki.org (CC BY-SA 4.0) · <a href="https://tatoeba.org" rel="noopener">Tatoeba</a> (CC BY 2.0 FR)</p></footer>`;
// The progress page shows what's kept in this browser: a page, but nothing to index.
const PROGRESS_PAGE = { route: { page: 'progress' } as Route, description: 'Your Krotik progress, kept only in this browser.', index: false, body: '<h1>Your progress</h1><p>Progress is kept only in your browser, and only if you turn it on.</p>' };
const SITE_DESCRIPTION = 'Learn and drill Russian grammar: short explanations with real examples, instant drills, a grammar test and hand-picked culture links. Free, no login.';

const pages: Page[] = [];
pages.push({
  route: { page: 'home' },
  description: SITE_DESCRIPTION,
  index: true,
  body: `<h1>Krotik</h1><p>${esc(SITE_DESCRIPTION)}</p><ul><li>${a({ page: 'start' }, 'Start here')}: a short guide for new learners</li><li>${a({ page: 'learn' }, 'Learn & drill')}: every topic, from the alphabet to participles</li><li>${a({ page: 'words' }, 'Words')}: everyday vocabulary by theme</li><li>${a({ page: 'test' }, 'Grammar test')}: 60 questions from A1 to C1</li><li>${a({ page: 'reading' }, 'Reading')}: Tolstoy and Chekhov, every word explained</li><li>${a({ page: 'culture' }, 'Culture')}: films, podcasts, books and notes</li></ul>`,
});
pages.push({
  route: { page: 'test' },
  description: 'A free 60-question Russian grammar test from A1 to C1, easiest first, with every answer explained and the Learn pages to review.',
  index: true,
  body: '<h1>Grammar test <span lang="ru">тест по грамматике</span></h1><p>Sixty multiple-choice questions on Russian grammar, twelve at each level from A1 to C1, easiest first. Every question is a real sentence with one gap. At the end you get an estimate of your grammar level, every wrong answer explained, and the Learn pages worth reviewing. It measures grammar only, not a full CEFR level.</p>',
});
pages.push({
  route: { page: 'learn' },
  description: 'Short explanations of Russian grammar with real example sentences and tables of forms: cases, aspect, verbs of motion, participles, word order and more.',
  index: true,
  body: `<h1>Learn &amp; drill <span lang="ru">учить</span></h1><p>Every topic, easiest first in each group, with a short explanation and a drill.</p>${TOPIC_GROUPS.map(
    (g) =>
      `<h2>${esc(g.title.en)} <span lang="ru">${esc(g.title.ru)}</span></h2><ul>${g.modes
        .map((t) => `<li>${learnIds.has(t.id) ? a({ page: 'learn', topic: t.id }, t.title.en) : esc(t.title.en)} <span lang="ru">${esc(t.title.ru)}</span>${isDrill(t) ? ` · ${a({ page: 'drill', mode: t.id }, 'Drill')}` : ''}</li>`)
        .join('')}</ul>`,
  ).join('')}`,
});
for (const id of [...learnIds].sort()) {
  const t = topicById(id);
  if (!t) continue;
  const src = readFileSync(`content/learn/${id}.md`, 'utf8');
  const near = neighbours(id);
  const related = t.related.map((r) => topicById(r)).filter((r) => !!r && learnIds.has(r.id));
  pages.push({
    route: { page: 'learn', topic: id },
    description: summary(src),
    index: true,
    body: `<p>${a({ page: 'learn' }, 'Learn')} ›</p><h1>${esc(t.title.en)} <span lang="ru">${esc(t.title.ru)}</span></h1><p>${t.level[0] === t.level[1] ? `Level ${t.level[0]}` : `First met at ${t.level[0]} · core by ${t.level[1]}`}</p>
${markdown(src)}
${isDrill(t) ? `<p>${a({ page: 'drill', mode: t.id }, `Drill: ${t.title.en}`)}</p>` : ''}${related.length ? `<h2>Related topics</h2><ul>${related.map((r) => `<li>${a({ page: 'learn', topic: r!.id }, r!.title.en)}</li>`).join('')}</ul>` : ''}<nav aria-label="Lessons">${near.prev ? `<p>Previous: ${a({ page: 'learn', topic: near.prev.id }, near.prev.title.en)}</p>` : ''}${near.next ? `<p>Next: ${a({ page: 'learn', topic: near.next.id }, near.next.title.en)}</p>` : ''}</nav>`,
  });
}
pages.push({
  route: { page: 'drill' },
  description: 'Instant drills for Russian grammar: verb forms, aspect, motion verbs, cases, adjectives, numbers and sentence drills, with retries and real examples.',
  index: true,
  body: `<h1>Choose a drill</h1>${TOPIC_GROUPS.map((g) => ({ ...g, modes: g.modes.filter(isDrill) }))
    .filter((g) => g.modes.length)
    .map((g) => `<h2>${esc(g.title.en)}</h2><ul>${g.modes.map((t) => `<li>${a({ page: 'drill', mode: t.id }, t.title.en)}: ${esc(t.blurb)}</li>`).join('')}</ul>`)
    .join('')}`,
});
for (const t of ALL_TOPICS.filter(isDrill)) {
  pages.push({
    route: { page: 'drill', mode: t.id },
    description: `Practise ${t.title.en} (${t.title.ru}): ${t.blurb}. Instant feedback, retries and real example sentences.`,
    index: false,
    body: `<h1>Drill: ${esc(t.title.en)} <span lang="ru">${esc(t.title.ru)}</span></h1><p>${esc(t.blurb)}.</p>${learnIds.has(t.id) ? `<p>${a({ page: 'learn', topic: t.id }, `Learn: ${t.title.en}`)}</p>` : ''}`,
  });
}
// ---- Reading: the full text (public domain) and the questions in English
const readingIndex = json<ReadingIndex>('reading.json');
const unitTitle = (u: { w: number; title: string }) => {
  const w = readingIndex.works[u.w]!;
  return w.kind === 'play' ? `${w.title}: ${u.title.replace(/^Явление/, 'явление')}` : u.title;
};
pages.push({
  route: { page: 'reading' },
  description: 'Read real Russian literature with every word explained: short stories by Leo Tolstoy and comedies by Anton Chekhov, with comprehension questions.',
  index: true,
  body: `<h1>Reading <span lang="ru">чтение</span></h1><p>Real Russian literature in modern spelling, public domain: tap or hover any word to see what it means, then answer a few questions.</p>${readingIndex.works
    .map((w, wi) => {
      const units = readingIndex.units.filter((u) => u.w === wi);
      return units.length ? `<h2 lang="ru">${esc(w.author)}, «${esc(w.title)}» (${w.year})</h2><ul>${units.map((u) => `<li>${a({ page: 'reading', text: u.id }, u.title)}: ${u.words} words</li>`).join('')}</ul>` : '';
    })
    .join('')}`,
});
for (const meta of readingIndex.units) {
  const u = json<ReadingUnit>(`reading.${meta.id}.json`);
  const w = readingIndex.works[u.w]!;
  const first = u.lines.find((l) => !l[2])?.[1] ?? '';
  pages.push({
    route: { page: 'reading', text: u.id },
    description: `${unitTitle(u)} by ${w.authorEn} (${w.year}), in Russian with every word explained and comprehension questions. ${first.slice(0, 80)}${first.length > 80 ? '…' : ''}`,
    index: true,
    body: `<p>${a({ page: 'reading' }, 'Reading')} ›</p><h1 lang="ru">${esc(unitTitle(u))}</h1><p><span lang="ru">${esc(w.author)}, «${esc(w.title)}»</span> (${w.year}). Public domain, from <a href="${esc(w.source)}" rel="noopener">Russian Wikisource</a>.</p>${
      u.keyWords.length >= 3 ? `<h2>Key words</h2><ul>${u.keyWords.map(([, , dict, meaning]) => `<li><span lang="ru">${esc(renderForm(dict.split(',')[0]!, true))}</span>: ${esc(meaning)}</li>`).join('')}</ul>` : ''
    }<div lang="ru">${u.lines
      .map(([speaker, text, stage]) => (stage ? `<p><em>${esc(text)}</em></p>` : `<p>${speaker ? `<strong>${esc(speaker)}.</strong> ` : ''}${esc(text)}</p>`))
      .join('')}</div><h2>Questions</h2><ol>${u.questions.map((q) => `<li>${esc(q.en.q)}<ul>${q.en.options.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></li>`).join('')}</ol>`,
  });
}

// ---- Words: themes with their words, real sentences and the reviewed dialogues
const themeIndex = json<ThemeIndex>('themes.json');
pages.push({
  route: { page: 'words' },
  description: 'Learn everyday Russian words by theme: food, family, home, travel, weather and more, with stress, meanings, real example sentences, dialogues and practice.',
  index: true,
  body: `<h1>Words <span lang="ru">слова</span></h1><p>Everyday Russian vocabulary, one theme at a time: words with stress and meaning, real example sentences, short dialogues and practice.</p>${[...new Set(themeIndex.themes.map((t) => t.level))]
    .map((lvl) => `<h2>${lvl}</h2><ul>${themeIndex.themes.filter((t) => t.level === lvl).map((t) => `<li>${a({ page: 'words', theme: t.id }, t.title)} (<span lang="ru">${esc(t.ru)}</span>): ${esc(t.blurb)}</li>`).join('')}</ul>`)
    .join('')}`,
});
const GENDER: Record<string, string> = { m: 'masculine', f: 'feminine', n: 'neuter', impf: 'imperfective', pf: 'perfective', pl: 'plural only' };
for (const meta of themeIndex.themes) {
  const t = json<ThemeData>(`theme.${meta.id}.json`);
  const words = t.groups.flatMap((g) => g.words);
  pages.push({
    route: { page: 'words', theme: t.id },
    description: `Russian words for ${t.title.toLowerCase()} (${t.ru}): ${words.slice(0, 6).map((w) => w[1].split(',')[0]!.replace(/'/g, '')).join(', ')} and more, with stress, meanings, real example sentences and practice.`,
    index: true,
    body: `<p>${a({ page: 'words' }, 'Words')} ›</p><h1>${esc(t.title)} <span lang="ru">${esc(t.ru)}</span></h1><p>${esc(t.level)}. ${esc(t.blurb)}</p>${t.groups
      .map((g) => `<h2>${esc(g.title)}</h2><ul>${g.words.map((w) => `<li><span lang="ru">${esc(renderForm(w[1].split(',')[0]!, true))}</span>${GENDER[w[4]] && w[3] !== 'a' ? ` (${GENDER[w[4]]})` : ''}: ${esc(w[2])}</li>`).join('')}</ul>`)
      .join('')}${t.dialogues
      .map((d) => `<h2>${esc(d.title)}</h2>${d.lines.map((l, i) => `<p><strong lang="ru">${esc(l[0])}:</strong> <span lang="ru">${esc(l[1])}</span> <em>${esc(d.en[i] ?? '')}</em></p>`).join('')}`)
      .join('')}<h2>In use</h2><ul>${words
      .filter((w) => t.uses[w[0]])
      .map((w) => {
        const [id, ru, en, start, end] = t.uses[w[0]]!;
        return `<li>${sentence(id, ru, en, start, end)}</li>`;
      })
      .join('')}</ul>`,
  });
}

const TYPES: [string, string][] = [
  ['video', 'Videos'],
  ['cartoons', 'Cartoons'],
  ['films', 'Films and series'],
  ['podcast', 'Podcasts'],
  ['reading', 'Reading and audiobooks'],
  ['tool', 'Tools and dictionaries'],
];
pages.push({
  route: { page: 'culture' },
  description: 'Hand-picked Russian videos, cartoons, films, podcasts, reading and tools for learners, from Russia, Kazakhstan, Central Asia and beyond, with notes on culture.',
  index: true,
  body: `<h1>Culture <span lang="ru">культура</span></h1><h2>Notes</h2><ul>${notes.filter((n) => !n.parent).map((n) => `<li>${a({ page: 'culture', note: n.id }, n.title)}: ${esc(n.blurb)}</li>`).join('')}</ul>${TYPES.map(
    ([type, label]) =>
      `<h2>${label}</h2><ul>${links
        .filter((l) => l.type === type)
        .map((l) => `<li><a href="${esc(l.url)}" rel="noopener noreferrer external">${esc(l.title)}</a>: ${esc(l.about)}</li>`)
        .join('')}</ul>`,
  ).join('')}`,
});
for (const n of notes) {
  pages.push({
    route: { page: 'culture', note: n.id },
    description: n.blurb,
    index: true,
    body: `<p>${a({ page: 'culture' }, 'Culture')} ›${n.parent ? ` ${a({ page: 'culture', note: n.parent }, notes.find((x) => x.id === n.parent)?.title ?? '')} ›` : ''}</p><h1>${esc(n.title)} <span lang="ru">${esc(n.ru)}</span></h1>${markdown(readFileSync(`content/culture/notes/${n.id}.md`, 'utf8'))}${
      notes.some((x) => x.parent === n.id) ? `<h2>Country by country</h2><ul>${notes.filter((x) => x.parent === n.id).map((x) => `<li>${a({ page: 'culture', note: x.id }, x.title)}: ${esc(x.blurb)}</li>`).join('')}</ul>` : ''
    }`,
  });
}
pages.push({
  route: { page: 'start' },
  description: 'How to learn Russian grammar with Krotik: what is here, the order to start in, and how the drills work.',
  index: true,
  body: `<h1>Start here <span lang="ru">с чего начать</span></h1><p>Krotik is a free place to learn Russian grammar and practise it until it's automatic, with no account.</p><h2>New to Russian? Try this order</h2><ol>${(['alphabet', 'stress', 'pronouns', 'verbs', 'nounCases', 'prepositions', 'adjectives', 'plurals', 'questionWords', 'numbers', 'time'] as const)
    .map((id) => topicById(id)!)
    .map((t) => `<li>${a({ page: 'learn', topic: t.id }, t.title.en)} <span lang="ru">${esc(t.title.ru)}</span></li>`)
    .join('')}</ol><h2>Already know some Russian?</h2><p>Take the ${a({ page: 'test' }, 'Grammar test')}, then review the Learn pages it suggests.</p><h2>How drills work</h2><p>Type the answer and press Enter. A wrong answer comes back about ten cards later; the round ends when everything is right. Use the on-screen keyboard or phonetic typing (zh → ж, ch → ч, sh → ш) if you have no Russian keyboard.</p>`,
});
pages.push(PROGRESS_PAGE);
pages.push({
  route: { page: 'about' },
  description: 'About Krotik: where the Russian forms and sentences come from (OpenRussian, Wiktionary, Tatoeba), their licences, and what is kept in your browser.',
  index: true,
  body: '<h1>About</h1><p>Krotik is a free, no-login site for learning and drilling Russian grammar. Every Russian form comes from a source: OpenRussian.org and Wiktionary (CC BY-SA 4.0); example sentences and translations come from Tatoeba (CC BY 2.0 FR); the reading texts are public-domain stories and plays by Tolstoy and Chekhov from Russian Wikisource. There are no accounts, no analytics and no cookies; progress tracking is optional and kept only in your browser.</p>',
});

// ---- write
const noteTitle = (id: string) => notes.find((n) => n.id === id)?.title;
const textTitle = (id: string) => {
  const u = readingIndex.units.find((x) => x.id === id);
  return u ? unitTitle(u) : undefined;
};
const themeTitle = (id: string) => themeIndex.themes.find((t) => t.id === id)?.title;
function html(p: Page, robots = p.index ? '' : 'noindex'): string {
  const url = SITE_URL + pathOf(p.route);
  const title = pageTitle(p.route, noteTitle, p.route.page === 'words' ? themeTitle : textTitle);
  const head = [
    `<title>${esc(title)}</title>`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="website" />`,
    ...(robots ? [`<meta name="robots" content="${robots}" />`] : []),
  ].join('\n    ');
  const out = template
    .replace(/<title>[^<]*<\/title>/, head)
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(p.description)}" />`)
    .replace('<div id="app"></div>', `<div id="app"><div class="prerendered">${nav}<main id="main">${p.body}</main>${footer}</div></div>`);
  if (out === template) throw new Error('prerender: the template has changed; update scripts/prerender.ts');
  return out;
}

for (const p of pages) {
  const file = join(DIST, pathOf(p.route), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html(p));
}
// GitHub Pages serves 404.html for any other address; the app starts there and shows the Dashboard.
writeFileSync(join(DIST, '404.html'), html({ route: { page: 'home' }, description: SITE_DESCRIPTION, index: false, body: '<h1>Page not found</h1><p>Krotik will open the home page.</p>' }));
const indexed = pages.filter((p) => p.index);
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexed.map((p) => `  <url><loc>${SITE_URL}${pathOf(p.route)}</loc></url>`).join('\n')}\n</urlset>\n`,
);
console.log(`prerendered ${pages.length} pages (${indexed.length} in sitemap.xml), and 404.html`);

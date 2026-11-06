/**
 * Learn pages: one Markdown file per topic in content/learn/<topic>.md, loaded on demand.
 *
 * Supported Markdown: ## and ### headings, paragraphs, "- " and "1. " lists, "> " tips, | tables |, and inline
 * **bold**, *italic*, `code`. Lines starting with "::" are data blocks, so examples always come from
 * the data rather than being typed in:
 *   ::table noun книга            full paradigm from the data (also: verb, adjective, pronouns,
 *                                  participles <verb>, numeral <word>, possessive <word>)
 *   ::sentence verb читать past_f  a Tatoeba sentence containing exactly that form (cell key, or "inf")
 *   ::sentence participle читать читая   …or, for participles/verbal adverbs, the exact form
 *   ::drill nounCases {"cases":["acc"]} 5   a short on-page drill (mode, settings for that mode, count)
 *   ::examples chtoby past 3       the shortest real sentences of one sentence-drill kind, target highlighted
 */
const files = import.meta.glob('/content/learn/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

const idOf = (path: string) => path.split('/').pop()!.replace(/\.md$/, '');
/** Topics that have a Learn page written. */
export const LEARN_TOPICS: ReadonlySet<string> = new Set(Object.keys(files).map(idOf));

export async function loadLearn(topic: string): Promise<string | null> {
  const f = files[`/content/learn/${topic}.md`];
  return f ? f() : null;
}

export type TableKind = 'noun' | 'verb' | 'adjective' | 'pronouns' | 'participles' | 'numeral' | 'possessive';
export type SentenceKind = 'noun' | 'verb' | 'adjective' | 'participle';
const TABLE_KINDS: TableKind[] = ['noun', 'verb', 'adjective', 'pronouns', 'participles', 'numeral', 'possessive'];

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { type: 'heading'; level: 2 | 3; text: Inline[] }
  | { type: 'para'; text: Inline[] }
  | { type: 'tip'; text: Inline[] }
  | { type: 'list'; items: Inline[][]; ordered?: boolean }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { type: 'data'; kind: 'table'; what: TableKind; word: string }
  | { type: 'data'; kind: 'sentence'; what: SentenceKind; word: string; cell: string }
  | { type: 'data'; kind: 'drill'; mode: string; settings: Record<string, unknown>; count: number }
  | { type: 'data'; kind: 'examples'; topic: string; item: string; count: number };

/** **bold**, *italic*, `code` */
export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > last) out.push({ text: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) out.push({ text: m[2], italic: true });
    else out.push({ text: m[3]!, code: true });
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

function parseDirective(line: string): Block {
  const m = /^::(\w+)\s*(.*)$/.exec(line.trim());
  if (!m) throw new Error(`Bad data block: ${line}`);
  const [, kind, rest] = m as unknown as [string, string, string];
  if (kind === 'table') {
    const [what, word = ''] = rest.split(/\s+/);
    if (!TABLE_KINDS.includes(what as TableKind)) throw new Error(`::table: unknown type ${what}`);
    return { type: 'data', kind: 'table', what: what as TableKind, word };
  }
  if (kind === 'sentence') {
    const [what, word, cell] = rest.split(/\s+/);
    if (!what || !word || !cell) throw new Error(`::sentence needs type, word and cell: ${line}`);
    if (!['noun', 'verb', 'adjective', 'participle'].includes(what)) throw new Error(`::sentence: unknown type ${what}`);
    return { type: 'data', kind: 'sentence', what: what as SentenceKind, word, cell };
  }
  if (kind === 'drill') {
    const dm = /^(\w+)\s*(\{.*\})?\s*(\d+)?$/.exec(rest.trim());
    if (!dm) throw new Error(`::drill: ${line}`);
    return { type: 'data', kind: 'drill', mode: dm[1]!, settings: dm[2] ? JSON.parse(dm[2]) : {}, count: dm[3] ? Number(dm[3]) : 5 };
  }
  if (kind === 'examples') {
    const [topic, item, n] = rest.split(/\s+/);
    if (!topic || !item) throw new Error(`::examples needs a topic and a kind: ${line}`);
    return { type: 'data', kind: 'examples', topic, item, count: n ? Number(n) : 3 };
  }
  throw new Error(`Unknown data block ::${kind}`);
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: 'para', text: parseInline(para.join(' ')) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.trim();
    if (!t || t.startsWith('<!--')) {
      flush();
      continue;
    }
    if (t.startsWith('::')) {
      flush();
      blocks.push(parseDirective(t));
    } else if (/^#{2,3}\s/.test(t)) {
      flush();
      const level = t.startsWith('###') ? 3 : 2;
      blocks.push({ type: 'heading', level, text: parseInline(t.replace(/^#+\s*/, '')) });
    } else if (t.startsWith('- ')) {
      flush();
      const items: Inline[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('- ')) items.push(parseInline(lines[i++]!.trim().slice(2)));
      i--;
      blocks.push({ type: 'list', items });
    } else if (/^\d+\.\s/.test(t)) {
      flush();
      const items: Inline[][] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!.trim())) items.push(parseInline(lines[i++]!.trim().replace(/^\d+\.\s+/, '')));
      i--;
      blocks.push({ type: 'list', items, ordered: true });
    } else if (t.startsWith('> ')) {
      flush();
      const tip: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('>')) tip.push(lines[i++]!.trim().replace(/^>\s?/, ''));
      i--;
      blocks.push({ type: 'tip', text: parseInline(tip.join(' ')) });
    } else if (t.startsWith('|')) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        const cells = lines[i++]!.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
      }
      i--;
      const [head = [], ...body] = rows;
      blocks.push({ type: 'table', head: head.map(parseInline), rows: body.map((r) => r.map(parseInline)) });
    } else {
      para.push(t);
    }
  }
  flush();
  return blocks;
}

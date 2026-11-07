/** Learn pages: one Markdown file per topic in content/learn/<topic>.md, loaded on demand. The Markdown syntax and
 * data blocks are described in markdown.ts. */
export * from './markdown.ts';

const files = import.meta.glob('/content/learn/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

const idOf = (path: string) => path.split('/').pop()!.replace(/\.md$/, '');
/** Topics that have a Learn page written. */
export const LEARN_TOPICS: ReadonlySet<string> = new Set(Object.keys(files).map(idOf));

export async function loadLearn(topic: string): Promise<string | null> {
  const f = files[`/content/learn/${topic}.md`];
  return f ? f() : null;
}


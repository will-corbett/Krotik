import type { Report } from './report.ts';
export async function buildSentences(_: { verbs: unknown; adjectives: unknown; nouns: unknown; others: unknown; deny: Record<string, string>; report: Report }): Promise<Record<string, { band: number; file: string; lemmas: number; sentences: number; bytes: number }[]>> {
  return {};
}

/** Guided writing prompts (content/writing.yaml, parsed at build time). */
import data from '../../content/writing.yaml';

export interface WritingPrompt {
  id: string;
  title: string;
  task: string;
  /** a suggested length in words, e.g. "40-60" */
  words: string;
  checklist: string[];
  learn: string[];
  vocab: string[];
}
export const WRITING = data as { level: string; prompts: WritingPrompt[] }[];

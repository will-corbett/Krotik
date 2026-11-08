/**
 * Where a Reading text comes from, for the line under its title (the app and the prerendered page): public-domain
 * literature from Russian Wikisource, or a Russian Wikinews article (CC BY 4.0, credited to Wikinews contributors).
 */
import type { ReadingIndex } from '../shared/types.ts';

type Work = ReadingIndex['works'][number];
export interface ReadingCredit {
  /** "Антон Чехов, «Рассказы» (1883)" or "Викиновости, 23 марта 2013" */
  by: string;
  licence: string;
  licenceUrl?: string;
  site: string;
  url: string;
}
export function readingCredit(w: Work, u: { title: string; source?: string; date?: string; year?: number }): ReadingCredit {
  const url = u.source ?? w.source;
  if (w.site === 'wikinews') {
    return { by: `${w.author}${u.date ? `, ${u.date}` : ''}`, licence: 'Wikinews contributors, CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/', site: 'Russian Wikinews', url };
  }
  // A story of a collection is named itself, with its own year: "Антон Чехов, «Хамелеон» (1884)".
  return { by: u.year ? `${w.author}, «${u.title}» (${u.year})` : `${w.author}, «${w.title}» (${w.year})`, licence: 'Public domain', site: 'Russian Wikisource', url };
}

/** What a question asks beyond what happens: shown as a small label beside it. */
export const QUESTION_KIND = {
  inference: { en: 'Reading between the lines', ru: 'между строк' },
  tone: { en: 'Tone and attitude', ru: 'тон' },
} as const;

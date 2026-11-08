/** The learning paths themselves (content/paths.yaml, parsed at build time). Logic is in paths.ts, which the
 *  prerender script also uses (it can't import YAML). */
import data from '../../content/paths.yaml';
import type { Path } from './paths.ts';

export const PATHS = data as Path[];
export const pathFor = (level: string) => PATHS.find((p) => p.level === level);

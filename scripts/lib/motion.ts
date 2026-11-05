import type { MotionPair } from '../../src/shared/types.ts';
import type { Verb } from './clean-verbs.ts';
import type { Report } from './report.ts';

/** Hand-curated: the 12 basic pairs (unidirectional, multidirectional) and English meanings. */
export const MOTION_PAIRS: [string, string, string][] = [
  ['идти', 'ходить', 'go (on foot), walk'],
  ['ехать', 'ездить', 'go (by vehicle), ride, drive'],
  ['бежать', 'бегать', 'run'],
  ['лететь', 'летать', 'fly'],
  ['плыть', 'плавать', 'swim, sail, float'],
  ['нести', 'носить', 'carry (on foot)'],
  ['вести', 'водить', 'lead, take (on foot)'],
  ['везти', 'возить', 'transport, take (by vehicle)'],
  ['лезть', 'лазить', 'climb'],
  ['ползти', 'ползать', 'crawl'],
  ['тащить', 'таскать', 'drag, haul'],
  ['гнать', 'гонять', 'chase, drive (herd)'],
];

export function buildMotion(verbs: Verb[], report: Report): MotionPair[] {
  const by = new Map(verbs.map((v) => [v.bare, v]));
  const out: MotionPair[] = [];
  for (const [u, m, meaning] of MOTION_PAIRS) {
    const uv = by.get(u);
    const mv = by.get(m);
    if (!uv || !mv) {
      report.anomaly('Motion verbs', 'pair missing from cleaned verbs (dropped)', `${u}/${m}: missing ${!uv ? u : m}`);
      continue;
    }
    for (const v of [uv, mv]) if (v.aspect !== 'impf') report.anomaly('Motion verbs', 'motion verb not imperfective in source', v.bare);
    out.push({ meaning, uni: uv.accented, multi: mv.accented, uniId: uv.id, multiId: mv.id });
  }
  report.count('Motion verbs', 'pairs available', out.length);
  return out;
}

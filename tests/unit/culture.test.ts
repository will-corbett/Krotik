import { describe, expect, it } from 'vitest';
import { filterLinks, LEVELS, LINK_TYPES, LINKS, NOTES, REGIONS, TOPICS, type CultureFilter } from '../../src/lib/culture.ts';

const ANY: CultureFilter = { level: 'any', kind: 'any', region: 'any', topic: 'any', text: '' };

describe('culture links', () => {
  it('there are 100–160 links', () => {
    expect(LINKS.length).toBeGreaterThanOrEqual(100);
    expect(LINKS.length).toBeLessThanOrEqual(160);
  });
  it('every link is complete and well-formed', () => {
    for (const l of LINKS) {
      const at = l.title;
      expect(l.title, at).toBeTruthy();
      expect(l.url, at).toMatch(/^https:\/\//);
      expect(() => new URL(l.url), at).not.toThrow();
      expect(LINK_TYPES, at).toContain(l.type);
      expect(['learner', 'native'], at).toContain(l.kind);
      expect(REGIONS, at).toContain(l.region);
      expect(TOPICS, at).toContain(l.topic);
      expect(l.level, at).toHaveLength(2);
      expect(LEVELS, at).toContain(l.level[0]);
      expect(LEVELS, at).toContain(l.level[1]);
      expect(LEVELS.indexOf(l.level[0]), at).toBeLessThanOrEqual(LEVELS.indexOf(l.level[1]));
      expect(l.about.length, at).toBeGreaterThan(20);
      expect(l.about.length, at).toBeLessThan(220);
      expect(l.checked, at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it('no duplicate links', () => {
    expect(new Set(LINKS.map((l) => l.url)).size).toBe(LINKS.length);
  });
  it('podcast links go to the show on Apple Podcasts or the show’s own site', () => {
    for (const l of LINKS.filter((x) => x.type === 'podcast')) expect(l.url, l.title).toMatch(/^https:\/\/(podcasts\.apple\.com\/gb\/podcast\/id\d+|[^/]+\/?$)/);
  });
  it('YouTube links go to a channel, never to a single re-uploaded video', () => {
    for (const l of LINKS.filter((x) => /youtube\.com|youtu\.be/.test(x.url))) expect(l.url, l.title).toMatch(/^https:\/\/www\.youtube\.com\/@[^/]+$/);
  });
  it('no music links (copyright)', () => {
    for (const l of LINKS) expect(l.url, l.title).not.toMatch(/music\.youtube|spotify|soundcloud|genius\.com|lyrics/i);
  });
  it('filters by level range, audience and region', () => {
    const b1 = filterLinks(LINKS, { ...ANY, level: 'B1' });
    expect(b1.length).toBeGreaterThan(0);
    for (const l of b1) expect(LEVELS.indexOf(l.level[0])).toBeLessThanOrEqual(2);
    const kz = filterLinks(LINKS, { ...ANY, region: 'kazakhstan' });
    expect(kz.length).toBeGreaterThan(0);
    for (const l of kz) expect(l.region).toBe('kazakhstan');
    expect(filterLinks(LINKS, { ...ANY, kind: 'learner' }).every((l) => l.kind === 'learner')).toBe(true);
  });
  it('filters by topic and free text (ё = е, every word must match)', () => {
    const chess = filterLinks(LINKS, { ...ANY, text: 'chess' });
    expect(chess.length).toBeGreaterThanOrEqual(2);
    expect(filterLinks(LINKS, { ...ANY, text: 'Мир наизнанку' }).map((l) => l.title)).toContain('Мир наизнанку');
    expect(filterLinks(LINKS, { ...ANY, text: 'орел решка' }).map((l) => l.title)).toContain('Орёл и Решка');
    for (const l of filterLinks(LINKS, { ...ANY, topic: 'cooking' })) expect(l.topic).toBe('cooking');
    expect(filterLinks(LINKS, { ...ANY, text: 'zzzz nothing' })).toEqual([]);
  });
  it('every region and type is used', () => {
    for (const r of REGIONS) expect(LINKS.some((l) => l.region === r), r).toBe(true);
    for (const t of LINK_TYPES) expect(LINKS.some((l) => l.type === t), t).toBe(true);
  });
  it('notes have ids, titles and Russian titles', () => {
    expect(NOTES.length).toBeGreaterThanOrEqual(4);
    for (const n of NOTES) {
      expect(n.id).toMatch(/^[a-z-]+$/);
      expect(n.title && n.ru && n.blurb).toBeTruthy();
    }
  });
});

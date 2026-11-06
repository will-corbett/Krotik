/**
 * Sentence drills from Tatoeba (Phase C). The answer is always the word actually used in the
 * sentence; for typed topics the blanked token must map to exactly one lemma, and for
 * multiple-choice topics every distractor must itself occur somewhere in the corpus.
 *
 * Row: [tatoeba id, russian, english, blank start, blank end, answer cell, hint, kind, options]
 */
import { cellForms } from '../../src/shared/forms.ts';
import { normalise } from '../../src/shared/normalise.ts';
import type { ClozeRow, PronounData } from '../../src/shared/types.ts';
import { ADJ_INDEX } from '../../src/shared/cells.ts';
import type { Adjective } from './clean-adjectives.ts';
import type { Noun } from './clean-nouns.ts';
import type { Verb } from './clean-verbs.ts';
import type { Report } from './report.ts';
import type { Corpus } from './sentences.ts';
import { TOKEN } from './sentences.ts';
import { writeJson } from './shard.ts';
import type { WkExtract } from './wiktionary.ts';
import type { PositionFamily, TimeWords } from './phase-e.ts';

const S = 'Sentence drills (Tatoeba)';
/** Max items per kind, chosen deterministically (by a hash of the sentence id). */
const CAP = 1500;

interface Tok {
  text: string;
  n: string; // normalised
  start: number;
  end: number;
}
function tokens(ru: string): Tok[] {
  return [...ru.matchAll(TOKEN)].map((m) => ({ text: m[0], n: normalise(m[0]), start: m.index!, end: m.index! + m[0].length }));
}
/** No punctuation between two tokens (they belong to the same phrase). */
const adjacent = (ru: string, a: Tok, b: Tok) => !/[,.;:!?—–()«»"]/.test(ru.slice(Math.min(a.end, b.end), Math.max(a.start, b.start)));

/** The source-accented variant of a cell that matches the token ("пришёл" → "пришё'л"). */
function accentedMatch(cell: string, token: string): string {
  const n = normalise(token);
  return cellForms(cell).find((f) => normalise(f) === n) ?? token.toLowerCase();
}

const hash = (n: number) => {
  let x = n ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
};
/** Per-topic caps where a topic has many kinds (one per preposition). */
const TOPIC_CAP: Record<string, number> = { prepositions: 400 };
function capped(rows: ClozeRow[], cap = CAP): ClozeRow[] {
  return [...rows].sort((a, b) => hash(a[0]) - hash(b[0]) || a[0] - b[0]).slice(0, cap);
}

/**
 * Prepositions and the cases they take (standard grammar; a hand-made table). Used to choose which
 * sentences qualify (the noun's form must be one of these cases) and to name the case afterwards.
 */
export const PREPOSITIONS: Record<string, string[]> = {
  в: ['acc', 'prep'], во: ['acc', 'prep'], на: ['acc', 'prep'], о: ['prep'], об: ['prep'], обо: ['prep'], при: ['prep'],
  у: ['gen'], без: ['gen'], для: ['gen'], до: ['gen'], из: ['gen'], от: ['gen'], около: ['gen'], после: ['gen'], кроме: ['gen'], против: ['gen'],
  с: ['gen', 'inst'], со: ['gen', 'inst'], к: ['dat'], ко: ['dat'], по: ['dat'],
  через: ['acc'], про: ['acc'], за: ['acc', 'inst'], под: ['acc', 'inst'], над: ['inst'], перед: ['inst'], между: ['inst'],
};
const CASE_BITS: Record<string, number[]> = { nom: [0, 6], gen: [1, 7], dat: [2, 8], acc: [3, 9], inst: [4, 10], prep: [5, 11] };

/** Government patterns → [preposition or "", case] */
export const GOV_PATTERN: Record<string, [string, string]> = {
  dat: ['', 'dat'], gen: ['', 'gen'], inst: ['', 'inst'], acc: ['', 'acc'], 'o+prep': ['о', 'prep'], 'na+acc': ['на', 'acc'],
  'na+prep': ['на', 'prep'], 'v+acc': ['в', 'acc'], 'v+prep': ['в', 'prep'], 'ot+gen': ['от', 'gen'], 'k+dat': ['к', 'dat'], 's+inst': ['с', 'inst'],
};

interface Input {
  corpus: Corpus;
  pronouns?: PronounData;
  government?: [number, string, string, string][];
  positions?: PositionFamily[];
  time?: TimeWords;
  verbs: Verb[];
  nouns: Noun[];
  adjectives: Adjective[];
  wk: WkExtract;
  report: Report;
}

export function buildCloze(inp: Input): Record<string, { file: string; count: number; kinds: Record<string, number> }> {
  const { corpus, report } = inp;
  const verbById = new Map(inp.verbs.map((v) => [v.id, v]));
  const nounById = new Map(inp.nouns.map((n) => [n.id, n]));
  /** Unique verb owner of a token, or null. */
  /** Capitalised mid-sentence, or sentence-initial but seen capitalised elsewhere: probably a name (Тому, Томе). */
  const nameLike = (t: Tok, toks: Tok[]) => /^[А-ЯЁ]/.test(t.text) && (t !== toks[0] || corpus.capitalisedMid.has(t.n));
  const ownerOf = (n: string, type: 'verbs' | 'nouns'): { id: number; mask: number } | null => {
    const o = corpus.owners.get(n);
    if (!o || o.size !== 1) return null;
    const owner = [...o][0]!;
    if (!owner.startsWith(type + ':')) return null;
    return { id: Number(owner.split(':')[1]), mask: corpus.masks.get(`${n}|${owner}`) ?? 0 };
  };
  const PAST = (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9);
  const GEN_SG = 1 << 1;
  const GEN_PL = 1 << 7;

  const kotoryi = inp.adjectives.find((a) => a.bare === 'который');
  const kotoryiForms = new Map<string, string>(); // normalised → accented
  for (const c of kotoryi?.cells ?? []) for (const f of cellForms(c)) kotoryiForms.set(normalise(f), f);

  const niPron = new Map<string, [string, string]>(); // normalised form → [accented form, lemma accented]
  for (const lemma of ['никто', 'ничто']) {
    const e = inp.wk.pronouns[lemma]?.[0];
    if (!e) {
      report.anomaly(S, 'pronoun table missing in Wiktionary', lemma);
      continue;
    }
    for (const [f] of e.forms) if (!/\s/.test(f)) niPron.set(normalise(f), [f, e.canonical]);
  }

  // Indefinite pronouns: stems that take -то / -нибудь / -либо / кое-.
  const INDEF = /^(кто|кого|кому|кем|ком|что|чего|чему|чем|чём|какой|какая|какое|какие|какого|какую|каким|каком|какому|какими|каких|где|куда|когда|откуда|как|почему|зачем|чей|чья|чьё|чьи|чьего|чьей|чьих|сколько)$/;
  const attested = new Set<string>();
  for (const { ru } of corpus.pairs) for (const t of tokens(ru)) if (/-(то|нибудь|либо)$|^кое-/.test(t.n)) attested.add(t.n);

  const verbByAccented = new Map(inp.verbs.map((v) => [v.accented, v]));
  const svoy = inp.pronouns?.possessive.find(([w]) => w === 'свой')?.[1] ?? [];
  const svoyForms = new Map<string, string>();
  for (const c of svoy) for (const f of cellForms(c)) svoyForms.set(normalise(f), f);

  const out: Record<string, ClozeRow[]> = {
    kotoryi: [], chtoby: [], conditional: [], negation: [], indefinite: [], particles: [],
    prepositions: [], aspectContext: [], svoy: [],
    government: [], position: [], impersonal: [], comparison: [], conjunctions: [], time: [],
  };
  const firstVerb = (bare: string) => inp.verbs.find((v) => v.bare === bare);
  const nounByBare = new Map<string, Noun>();
  for (const n of inp.nouns) if (!nounByBare.has(n.bare)) nounByBare.set(n.bare, n);

  // government: verb id → patterns
  const gov = new Map<number, string[]>();
  for (const [id, , pattern] of inp.government ?? []) (gov.get(id) ?? gov.set(id, []).get(id)!).push(pattern);

  // position verbs: verb id → [family, role, aspect]
  const posRole = new Map<number, { fam: PositionFamily; role: 'state' | 'put' | 'get' }>();
  for (const fam of inp.positions ?? []) {
    const add = (bare: string, role: 'state' | 'put' | 'get') => {
      const v = firstVerb(bare);
      if (v) posRole.set(v.id, { fam, role });
      else report.anomaly(S, 'position verb not in the verb data', bare);
    };
    add(fam.state, 'state');
    fam.put.forEach((b) => add(b, 'put'));
    fam.get.forEach((b) => add(b, 'get'));
  }
  const famVerb = (fam: PositionFamily, role: 'state' | 'put' | 'get', aspect: string): Verb | undefined => {
    if (role === 'state') return firstVerb(fam.state);
    return (role === 'put' ? fam.put : fam.get).map(firstVerb).find((v) => v?.aspect === aspect);
  };

  const dayIds = new Set((inp.time?.days ?? []).map((w) => nounByBare.get(w)?.id).filter((x): x is number => !!x));
  const monthIds = new Set((inp.time?.months ?? []).map((w) => nounByBare.get(w)?.id).filter((x): x is number => !!x));
  const unitIds = new Set((inp.time?.units ?? []).map((w) => nounByBare.get(w)?.id).filter((x): x is number => !!x));
  const impersonal = new Set(inp.time?.impersonal ?? []);
  const datPron = new Map<string, string>(); // normalised dative pronoun → [nominative]
  for (const [who, cells] of inp.pronouns?.personal ?? []) {
    if (!who || who === 'кто' || who === 'что') continue;
    for (const f of cellForms(cells[2] ?? '')) if (!datPron.has(normalise(f))) datPron.set(normalise(f), who); // ему → он, not оно
  }
  const comparatives = new Set<string>();
  for (const a of inp.adjectives) for (const f of cellForms(a.extra[4] ?? '')) comparatives.add(normalise(f));
  for (const w of ['больше', 'меньше', 'более', 'менее']) comparatives.delete(w); // also mean "more/less (of)"

  const neNi: ClozeRow[] = [];

  for (const { rid, ru, en } of corpus.pairs) {
    // Names stay in place (so adjacency is right) but can never match a word or a drill target.
    const toks = tokens(ru).map((t, _i, all) => (nameLike(t, all) ? { ...t, n: '' } : t));
    const count = (n: string) => toks.filter((t) => t.n === n).length;
    const row = (t: { start: number; end: number }, answer: string, hint: string, kind: string, options: string[] = []): ClozeRow => [rid, ru, en, t.start, t.end, answer, hint, kind, options];

    // --- который
    // Relative clauses only: который right after a comma, or after a comma and a preposition (", в котором").
    // (A question like "Которое пиво твоё?" is a different use.)
    const kt = toks.filter((t) => kotoryiForms.has(t.n));
    const nextAfterKt = kt.length === 1 ? toks[toks.indexOf(kt[0]!) + 1] : undefined;
    // "Который час?" means "what time is it?", an idiom rather than a relative clause.
    if (kt.length === 1 && normalise(nextAfterKt?.text ?? '') !== 'час' && /,\s*(?:[а-яё]+\s+)?$/i.test(ru.slice(0, kt[0]!.start)) && (/,\s*$/.test(ru.slice(0, kt[0]!.start)) || PREPOSITIONS[normalise(ru.slice(0, kt[0]!.start).replace(/^.*,\s*/, '').trim())])) {
      out.kotoryi!.push(row(kt[0]!, kotoryiForms.get(kt[0]!.n)!, 'кото\'рый', 'kotoryi'));
    }

    // --- чтобы + infinitive / past
    const ci = toks.findIndex((t) => t.n === 'чтобы');
    if (ci >= 0 && count('чтобы') === 1) {
      for (let j = ci + 1; j <= ci + 3 && j < toks.length; j++) {
        const t = toks[j]!;
        if (t.n === 'не') continue;
        const o = ownerOf(t.n, 'verbs');
        if (!o || !adjacent(ru, toks[ci]!, t) || count(t.n) !== 1) break;
        const v = verbById.get(o.id)!;
        if (normalise(v.bare) === t.n) out.chtoby!.push(row(t, v.accented, v.accented, 'inf'));
        else if (o.mask & PAST) out.chtoby!.push(row(t, accentedMatch(v.cells[[6, 7, 8, 9].find((i) => o.mask & (1 << i))!]!, t.text), v.accented, 'past'));
        break;
      }
    }

    // --- conditional: past tense + бы
    const bi = toks.findIndex((t) => t.n === 'бы');
    if (bi >= 0 && count('бы') === 1 && count('чтобы') === 0) {
      for (const d of [-1, 1, -2, 2]) {
        const t = toks[bi + d];
        if (!t || t.n === 'не') continue;
        const o = ownerOf(t.n, 'verbs');
        if (!o || !(o.mask & PAST) || !adjacent(ru, toks[bi]!, t) || count(t.n) !== 1) continue;
        const v = verbById.get(o.id)!;
        out.conditional!.push(row(t, accentedMatch(v.cells[[6, 7, 8, 9].find((i) => o.mask & (1 << i))!]!, t.text), v.accented, 'cond'));
        break;
      }
    }

    // --- negation: нет / не было / не будет + genitive noun
    for (let i = 0; i < toks.length - 1; i++) {
      const isNet = toks[i]!.n === 'нет';
      const isNeBylo = toks[i]!.n === 'не' && (toks[i + 1]?.n === 'было' || toks[i + 1]?.n === 'будет');
      if (!isNet && !isNeBylo) continue;
      const t = toks[i + (isNet ? 1 : 2)];
      if (!t || !adjacent(ru, toks[i]!, t) || count(t.n) !== 1) continue;
      const o = ownerOf(t.n, 'nouns');
      if (!o || !(o.mask & (GEN_SG | GEN_PL))) continue;
      const n = nounById.get(o.id)!;
      const own = o.mask & GEN_PL ? n.cells[7]! : n.cells[1]!;
      const other = o.mask & GEN_PL ? n.cells[1]! : n.cells[7]!;
      // нет книги / нет книг are both possible; the other number is accepted but not shown.
      const answer = [accentedMatch(own, t.text), ...(n.sgOnly || !other ? [] : cellForms(other).map((f) => `(${f})`))].join(',');
      out.negation!.push(row(t, answer, n.accented, 'net'));
      break;
    }
    // никто / ничто in any case, with не in the sentence
    const np = toks.filter((t) => niPron.has(t.n));
    if (np.length === 1 && count('не') >= 1) {
      const [form, lemma] = niPron.get(np[0]!.n)!;
      out.negation!.push(row(np[0]!, form, lemma, 'nipron'));
    }
    // не vs ни (multiple choice; used by both the negation and particles modes)
    const nn = toks.filter((t) => t.n === 'не' || t.n === 'ни');
    if (nn.length >= 1 && nn.length <= 2) {
      const target = nn.find((t) => t.n === 'ни') ?? nn[0]!;
      neNi.push(row(target, target.n, '', 'ne-ni', ['не', 'ни']));
    }

    // --- indefinite pronouns: -то / -нибудь / -либо / кое-
    const ip = toks.filter((t) => {
      const m = /^(?:кое-(.+)|(.+)-(то|нибудь|либо))$/.exec(t.n);
      return m && INDEF.test(m[1] ?? m[2]!);
    });
    if (ip.length === 1) {
      const t = ip[0]!;
      const m = /^(?:кое-(.+)|(.+)-(то|нибудь|либо))$/.exec(t.n)!;
      const stem = m[1] ?? m[2]!;
      const kind = m[1] ? 'koe' : m[3]!;
      const opts = [`${stem}-то`, `${stem}-нибудь`, `кое-${stem}`, ...(kind === 'либо' ? [`${stem}-либо`] : [])].filter((o) => o === t.n || attested.has(o));
      if (opts.length >= 2) out.indefinite!.push(row(t, t.n, '', kind, opts));
    }

    // --- particles
    const PARTICLE_GROUPS: [string, string[], string[]][] = [
      ['li', ['ли'], ['ли', 'же', 'бы', 'ведь']],
      ['zhe-ved', ['же', 'ведь'], ['же', 'ведь', 'ли', 'бы']],
      ['colloquial', ['вот', 'ну', 'даже', 'только'], ['вот', 'ну', 'даже', 'только']],
    ];
    for (const [kind, targets, options] of PARTICLE_GROUPS) {
      const hits = toks.filter((t) => targets.includes(t.n));
      if (hits.length === 1 && options.every((o) => o === hits[0]!.n || count(o) === 0)) {
        // kind per particle (li, zhe, ved, vot, nu, dazhe, tolko) so each is capped and balanced separately
        out.particles!.push(row(hits[0]!, hits[0]!.n, '', kind === 'li' ? 'li' : `${kind}:${hits[0]!.n}`, options));
        break;
      }
    }
    // --- preposition + noun: the noun's form must be a case that preposition takes
    for (let i = 0; i < toks.length - 1; i++) {
      const prep = toks[i]!.n;
      const cases = PREPOSITIONS[prep];
      if (!cases) continue;
      const t = toks[i + 1]!;
      if (!adjacent(ru, toks[i]!, t) || count(t.n) !== 1) continue;
      const o = ownerOf(t.n, 'nouns');
      if (!o) continue;
      const fits = cases.filter((c) => CASE_BITS[c]!.some((b) => o.mask & (1 << b)));
      // The form must fit the preposition, and fit no case the preposition doesn't take (so the case is clear).
      const allCases = Object.keys(CASE_BITS).filter((c) => CASE_BITS[c]!.some((b) => o.mask & (1 << b)));
      if (!fits.length || allCases.some((c) => !cases.includes(c))) continue;
      const n = nounById.get(o.id)!;
      const cellIdx = [...Array(12).keys()].find((b) => o.mask & (1 << b))!;
      out.prepositions!.push(row(t, accentedMatch(n.cells[cellIdx]!, t.text), n.accented, `${prep.replace(/^(во|обо|об|со|ко)$/, (m) => ({ во: 'в', обо: 'о', об: 'о', со: 'с', ко: 'к' })[m]!)}:${fits.join('+')}`));
      break;
    }

    // --- aspect in context: the verb vs its partner in the same form
    for (const t of toks) {
      if (count(t.n) !== 1) continue;
      const o = ownerOf(t.n, 'verbs');
      if (!o) continue;
      const v = verbById.get(o.id)!;
      if (v.aspect === 'both' || !v.partners.length) continue;
      // Only mutual pairs (видеть ↔ увидеть), not one-way source links (видеть → завидеть).
      const partner = v.partners
        .map((p) => verbByAccented.get(p))
        .find((p) => p && p.aspect !== 'both' && p.aspect !== v.aspect && p.partners.includes(v.accented));
      if (!partner) continue;
      let theirs = '';
      if (normalise(v.bare) === t.n) theirs = partner.accented;
      else {
        const ci = [...Array(12).keys()].find((b) => o.mask & (1 << b));
        if (ci === undefined || o.mask & ~(1 << ci)) continue; // the token must be exactly one cell
        theirs = cellForms(partner.cells[ci] ?? '')[0] ?? '';
      }
      const mine = normalise(v.bare) === t.n ? v.bare : accentedMatch(v.cells[[...Array(12).keys()].find((b) => o.mask & (1 << b))!]!, t.text).replace(/'/g, '');
      const other = theirs.replace(/'/g, '');
      if (!other || normalise(other) === t.n || toks.some((x) => x.n === normalise(other))) continue;
      out.aspectContext!.push(row(t, mine, '', v.aspect, v.aspect === 'impf' ? [mine, other] : [other, mine]));
      break;
    }

    // --- свой vs его / её / их
    const sv = toks.filter((t) => svoyForms.has(t.n));
    if (sv.length === 1 && !toks.some((t) => ['его', 'её', 'ее', 'их'].includes(t.n))) {
      out.svoy!.push(row(sv[0]!, sv[0]!.n, '', 'svoy', [sv[0]!.n, 'его', 'её', 'их']));
    }
    const ego = toks.findIndex((t) => ['его', 'её', 'ее', 'их'].includes(t.n));
    if (ego >= 0 && sv.length === 0 && toks.filter((t) => ['его', 'её', 'ее', 'их'].includes(t.n)).length === 1) {
      const t = toks[ego]!;
      const nextTok = toks[ego + 1];
      const o = nextTok && adjacent(ru, t, nextTok) ? ownerOf(nextTok.n, 'nouns') : null;
      const n = o ? nounById.get(o.id) : undefined;
      // Possessive use (его книга): a noun follows directly. The свой distractor must agree with that noun,
      // so the noun's form has to be exactly one cell.
      if (o && n?.gender && !(o.mask & (o.mask - 1))) {
        const b = Math.log2(o.mask);
        const plural = b >= 6;
        const c = (['nom', 'gen', 'dat', 'acc', 'inst', 'prep'] as const)[b % 6]!;
        const slot = plural ? 'pl' : n.gender;
        const key = c === 'acc' && (slot === 'm' || slot === 'pl') && n.animate ? `${slot}_acc_anim` : `${slot}_${c}`;
        const svoyForm = normalise(cellForms(svoy[ADJ_INDEX[key as keyof typeof ADJ_INDEX]] ?? '')[0] ?? '');
        const ans = t.n === 'ее' ? 'её' : t.n;
        if (svoyForm && c !== 'nom') out.svoy!.push(row(t, ans, '', 'ego', ['его', 'её', 'их', svoyForm]));
      }
    }

    // --- verb government: verb, then (preposition +) noun in the governed case
    for (let i = 0; i < toks.length - 1; i++) {
      const vo = ownerOf(toks[i]!.n, 'verbs');
      const patterns = vo ? gov.get(vo.id) : undefined;
      if (!patterns) continue;
      let done = false;
      for (const pattern of patterns) {
        const [prep, c] = GOV_PATTERN[pattern]!;
        let j = i + 1;
        if (prep) {
          if (toks[j]?.n !== prep || !adjacent(ru, toks[i]!, toks[j]!)) continue;
          j++;
        }
        const t = toks[j];
        if (!t || !adjacent(ru, toks[j - 1]!, t) || count(t.n) !== 1) continue;
        const o = ownerOf(t.n, 'nouns');
        if (!o || !CASE_BITS[c]!.some((b) => o.mask & (1 << b))) continue;
        // Without a preposition, skip forms that could also be nominative (the subject, not the object).
        if (!prep && c !== 'acc' && CASE_BITS.nom!.some((b) => o.mask & (1 << b))) continue;
        const n = nounById.get(o.id)!;
        const cellIdx = CASE_BITS[c]!.find((b) => o.mask & (1 << b))!;
        const v = verbById.get(vo!.id)!;
        out.government!.push(row(t, accentedMatch(n.cells[cellIdx]!, t.text), n.accented, `${pattern}|${v.accented}`));
        done = true;
        break;
      }
      if (done) break;
    }

    // --- verbs of position: state / put / get-into-position, same form, multiple choice
    for (const t of toks) {
      if (count(t.n) !== 1) continue;
      const o = ownerOf(t.n, 'verbs');
      const pr = o ? posRole.get(o.id) : undefined;
      if (!o || !pr) continue;
      const v = verbById.get(o.id)!;
      const isInf = normalise(v.bare) === t.n;
      const ci = isInf ? -1 : [...Array(12).keys()].find((b) => o.mask & (1 << b));
      if (ci === undefined || (!isInf && o.mask & ~(1 << ci))) break;
      const aspect = v.aspect;
      const opts: string[] = [];
      for (const role of ['state', 'put', 'get'] as const) {
        const fv = role === pr.role ? v : famVerb(pr.fam, role, aspect === 'both' ? 'impf' : aspect);
        if (!fv) continue;
        // Options in the source spelling (keeps ё: лёг), the sentence's own verb matched to its cell.
        const f = fv === v ? (isInf ? v.bare : accentedMatch(v.cells[ci]!, t.text).replace(/'/g, '')) : isInf ? fv.bare : (cellForms(fv.cells[ci] ?? '')[0] ?? '').replace(/'/g, '');
        if (f) opts.push(f);
      }
      const mineOpt = opts.find((o) => normalise(o) === t.n);
      if (mineOpt && opts.length >= 2 && new Set(opts.map(normalise)).size === opts.length) out.position!.push(row(t, mineOpt, '', `${pr.fam.family}:${pr.role}`, opts));
      break;
    }

    // --- impersonal: dative person + predicative (мне холодно, Тому надо…)
    for (let i = 1; i < toks.length; i++) {
      if (!impersonal.has(toks[i]!.n)) continue;
      const t = toks[i - 1]!;
      if (!adjacent(ru, t, toks[i]!) || count(t.n) !== 1) continue;
      // After a preposition it isn't the dative person: "в комнате жарко" is a location.
      if (i >= 2 && PREPOSITIONS[normalise(toks[i - 2]!.text)] && adjacent(ru, toks[i - 2]!, t)) continue;
      const pron = datPron.get(t.n);
      if (pron) {
        out.impersonal!.push(row(t, t.n, pron, 'imp-pron'));
        break;
      }
      const o = ownerOf(t.n, 'nouns');
      if (o && o.mask & ((1 << 2) | (1 << 8)) && !(o.mask & ((1 << 0) | (1 << 6)))) {
        const n = nounById.get(o.id)!;
        out.impersonal!.push(row(t, accentedMatch(n.cells[o.mask & (1 << 2) ? 2 : 8]!, t.text), n.accented, 'imp-noun'));
        break;
      }
    }

    // --- comparison: comparative + noun in the genitive (старше брата)
    for (let i = 0; i < toks.length - 1; i++) {
      if (!comparatives.has(toks[i]!.n)) continue;
      const t = toks[i + 1]!;
      if (!adjacent(ru, toks[i]!, t) || count(t.n) !== 1 || toks[i + 2]?.n === 'чем') continue;
      const o = ownerOf(t.n, 'nouns');
      if (!o || !(o.mask & ((1 << 1) | (1 << 7))) || o.mask & ((1 << 0) | (1 << 6))) continue;
      const n = nounById.get(o.id)!;
      out.comparison!.push(row(t, accentedMatch(n.cells[o.mask & (1 << 1) ? 1 : 7]!, t.text), n.accented, 'cmp-gen'));
      break;
    }

    // --- conjunctions что / чтобы / если / когда (one of them, used as a conjunction)
    const CONJ = ['что', 'чтобы', 'если', 'когда'];
    const cj = toks.filter((t) => CONJ.includes(t.n));
    if (cj.length === 1 && !/\?\s*$/.test(ru)) {
      const t = cj[0]!;
      const afterComma = /,\s*$/.test(ru.slice(0, t.start));
      const initial = t === toks[0];
      if ((t.n === 'что' && afterComma) || (t.n === 'когда' && (afterComma || initial)) || t.n === 'чтобы' || t.n === 'если') {
        out.conjunctions!.push(row(t, t.n, '', `conj:${t.n}`, CONJ));
      }
    }

    // --- time expressions
    for (let i = 0; i < toks.length; i++) {
      const a = toks[i]!;
      const b = toks[i + 1];
      const nounAt = (t: Tok | undefined) => (t ? ownerOf(t.n, 'nouns') : null);
      let hit: { t: Tok; kind: string; cell: number; id: number } | null = null;
      if ((a.n === 'в' || a.n === 'во') && b && adjacent(ru, a, b)) {
        const o = nounAt(b);
        if (o && dayIds.has(o.id) && o.mask & (1 << 3)) hit = { t: b, kind: 'v-day', cell: 3, id: o.id };
        else if (o && monthIds.has(o.id) && o.mask & (1 << 5)) hit = { t: b, kind: 'v-month', cell: 5, id: o.id };
      } else if (a.n === 'по' && b && adjacent(ru, a, b)) {
        const o = nounAt(b);
        if (o && dayIds.has(o.id) && o.mask & (1 << 8)) hit = { t: b, kind: 'po-days', cell: 8, id: o.id };
      } else if (a.n === 'через' && b && adjacent(ru, a, b)) {
        const o = nounAt(b);
        if (o && unitIds.has(o.id) && o.mask & (1 << 3)) hit = { t: b, kind: 'cherez', cell: 3, id: o.id };
      } else if (b?.n === 'назад' && adjacent(ru, a, b)) {
        const o = nounAt(a);
        if (o && unitIds.has(o.id)) {
          const cell = [3, 1, 7].find((x) => o.mask & (1 << x));
          if (cell !== undefined) hit = { t: a, kind: 'nazad', cell, id: o.id };
        }
      }
      if (hit && count(hit.t.n) === 1) {
        const n = nounById.get(hit.id)!;
        out.time!.push(row(hit.t, accentedMatch(n.cells[hit.cell]!, hit.t.text), n.accented, hit.kind));
        break;
      }
    }

    // -ка on an imperative (давай-ка, скажи-ка)
    const ka = toks.filter((t) => /-ка$/.test(t.n));
    if (ka.length === 1) {
      const t = ka[0]!;
      const base = t.n.slice(0, -3);
      const o = ownerOf(base, 'verbs');
      if (o && o.mask & ((1 << 10) | (1 << 11))) {
        const at = t.start + t.text.length - 3; // the "-ка" part, hyphen included
        out.particles!.push(row({ start: at, end: t.end }, '-ка', '', 'ka', ['-ка', '-то', '-нибудь']));
      }
    }
  }

  // не/ни: balance the two answers so "не" isn't nearly always right.
  const ni = neNi.filter((r) => r[5] === 'ни');
  const ne = neNi.filter((r) => r[5] === 'не');
  const balanced = [...capped(ni).slice(0, 750), ...capped(ne).slice(0, Math.min(750, ni.length))];
  out.negation!.push(...balanced);
  out.particles!.push(...balanced);

  const result: Record<string, { file: string; count: number; kinds: Record<string, number> }> = {};
  for (const [topic, rows] of Object.entries(out)) {
    const byKind = new Map<string, ClozeRow[]>();
    for (const r of rows) (byKind.get(r[7]) ?? byKind.set(r[7], []).get(r[7])!).push(r);
    const cap = TOPIC_CAP[topic] ?? CAP;
    // Kinds with fewer than 20 sentences (e.g. с + an ambiguous form) are too thin to drill.
    for (const [k, rs] of byKind) if (rs.length < 20) byKind.delete(k);
    const kept = [...byKind.values()].flatMap((rs) => capped(rs, cap)).sort((a, b) => a[0] - b[0]);
    const kinds = Object.fromEntries([...byKind].map(([k, rs]) => [k, Math.min(rs.length, cap)]));
    for (const [k, rs] of byKind) report.count(S, `${topic} / ${k}: candidates (kept up to ${cap})`, rs.length);
    const file = `cloze.${topic}.json`;
    writeJson(file, kept);
    result[topic] = { file, count: kept.length, kinds };
  }
  report.note(
    S,
    'Typed answers are the sentence’s own word; the blanked token must belong to exactly one lemma. Multiple-choice distractors are only forms seen elsewhere in Tatoeba. Some distractors can also fit a sentence (же/ведь, -то/-нибудь); the English translation is shown as a cue, and only the sentence’s own word counts.',
  );
  return result;
}

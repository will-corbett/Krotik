<script lang="ts">
  import { CASES, type Case, type VerbGroup } from '../shared/cells.ts';
  import { CASE_TERM, TERMS, type Term } from '../lib/terms.ts';
  import type { Settings } from '../lib/settings.ts';
  import { settingsValid } from '../lib/start.ts';
  import type { CompareSettings, Mode, MotionSettings, NumberSettings, ParticipleSettings, PluralSettings } from '../lib/types.ts';

  let { settings = $bindable(), loading, error, onstart }: { settings: Settings; loading: boolean; error: string; onstart: () => void } = $props();

  const GROUPS_OF_MODES: { title: Term; modes: { id: Mode; title: Term; blurb: string }[] }[] = [
    {
      title: TERMS.verbs,
      modes: [
        { id: 'verbs', title: TERMS.verbForms, blurb: 'Present/future, past, imperative' },
        { id: 'reflexive', title: TERMS.reflexive, blurb: '-ся after consonants, -сь after vowels' },
        { id: 'aspect', title: TERMS.aspectPartners, blurb: 'Imperfective ↔ perfective' },
        { id: 'motion', title: TERMS.motionVerbs, blurb: 'идти/ходить and 11 more pairs' },
        { id: 'adverbs', title: TERMS.adverbs, blurb: 'читая, прочитав' },
        { id: 'participles', title: TERMS.participles, blurb: 'читающий, прочитанный, прочитана' },
      ],
    },
    {
      title: TERMS.adjectives,
      modes: [
        { id: 'adjectives', title: TERMS.agreement, blurb: 'Gender, number, case, animacy' },
        { id: 'short', title: TERMS.shortForms, blurb: 'он нов, она нова́, они новы' },
        { id: 'compare', title: TERMS.degrees, blurb: 'новее, новейший, самый новый' },
      ],
    },
    {
      title: TERMS.nounsNumbers,
      modes: [
        { id: 'plurals', title: TERMS.plurals, blurb: 'Plural forms, after numbers and quantity words' },
        { id: 'numbers', title: TERMS.numbers, blurb: 'пяти, двум книгам, тремя друзьями' },
        { id: 'diminutives', title: TERMS.diminutives, blurb: 'дом → домик, сын → сынок' },
      ],
    },
  ];
  const COMPARE_TYPES: { id: CompareSettings['types'][number]; label: Term }[] = [
    { id: 'comparative', label: TERMS.comparative },
    { id: 'superlative', label: { en: 'Superlative (-ейший)', ru: TERMS.superlative.ru } },
    { id: 'samyi', label: TERMS.samyi },
  ];
  const PARTICIPLE_KINDS: { id: ParticipleSettings['kinds'][number]; label: Term }[] = [
    { id: 'act_pres', label: TERMS.act_pres },
    { id: 'act_past', label: TERMS.act_past },
    { id: 'pass_pres', label: TERMS.pass_pres },
    { id: 'pass_past', label: TERMS.pass_past },
  ];
  const PARTICIPLE_TYPES: { id: ParticipleSettings['types'][number]; label: Term }[] = [
    { id: 'form', label: { en: 'Form the participle', ru: 'образование' } },
    { id: 'short', label: TERMS.shortPassive },
    { id: 'decline', label: { en: 'Agree with a noun', ru: 'согласование' } },
  ];
  const NUMBER_TYPES: { id: NumberSettings['types'][number]; label: Term }[] = [
    { id: 'alone', label: { en: 'Decline the number', ru: 'склонение числительных' } },
    { id: 'withNoun', label: TERMS.numeralNoun },
  ];
  const NUMBER_RANGES: { id: NumberSettings['ranges'][number]; label: string }[] = [
    { id: '1-4', label: '1–4 and оба' },
    { id: '5-20', label: '5–20' },
    { id: 'tens', label: '30–90, 100–900' },
  ];
  const PLURAL_CONTEXTS: { id: PluralSettings['contexts'][number]; label: Term }[] = [
    { id: 'nom', label: { en: 'Nominative plural', ru: 'именительный падеж, мн. ч.' } },
    { id: 'cases', label: { en: 'Plural in other cases', ru: 'косвенные падежи' } },
    { id: 'numbers', label: { en: 'After numbers (2 стола, 5 столов)', ru: 'после числительных' } },
    { id: 'quantity', label: { en: 'After много, мало, несколько, сколько, нет', ru: 'после слов количества' } },
  ];
  const GROUPS: { id: VerbGroup; label: Term }[] = [
    { id: 'presfut', label: TERMS.presfut },
    { id: 'past', label: TERMS.past },
    { id: 'imperative', label: TERMS.imperative },
  ];
  const MOTION_TYPES: { id: MotionSettings['types'][number]; label: Term }[] = [
    { id: 'meaning', label: { en: 'Name the verb from its meaning', ru: 'значение' } },
    { id: 'partner', label: { en: 'Give the partner', ru: 'пара глаголов' } },
    { id: 'conjugate', label: TERMS.conjugation },
  ];
  const BANDS = ['Top 250', 'Top 1,000', 'Top 2,500', 'Everything'];

  function toggle<T>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }

  const invalid = $derived(settingsValid(settings));

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (!invalid && !loading) onstart();
  }
</script>

<form class="setup fade-in" onsubmit={submit}>
  <fieldset class="modes">
    <legend>Practise</legend>
    {#each GROUPS_OF_MODES as g (g.title.en)}
      <h2 class="group">{g.title.en} <span class="ru" lang="ru">{g.title.ru}</span></h2>
      <div class="mode-grid">
        {#each g.modes as m (m.id)}
          <label class="mode" class:selected={settings.mode === m.id}>
            <input type="radio" name="mode" value={m.id} bind:group={settings.mode} />
            <span class="mode-title">{m.title.en}</span>
            <span class="mode-ru" lang="ru">{m.title.ru}</span>
            <span class="mode-blurb">{m.blurb}</span>
          </label>
        {/each}
      </div>
    {/each}
  </fieldset>

  <div class="card options">
    {#if settings.mode === 'verbs' || settings.mode === 'reflexive'}
      {@const vs = settings.mode === 'verbs' ? settings.verbs : settings.reflexive}
      <fieldset>
        <legend>Tenses <span class="ru" lang="ru">времена</span></legend>
        <div class="chips">
          {#each GROUPS as g (g.id)}
            <label class="chip">
              <input type="checkbox" checked={vs.groups.includes(g.id)} onchange={() => (vs.groups = toggle(vs.groups, g.id))} />
              {g.label.en} <span class="ru" lang="ru">{g.label.ru}</span>
            </label>
          {/each}
        </div>
        {#if settings.mode === 'reflexive'}
          <p class="hint muted">
            Only verbs ending in -ся/-сь (<span lang="ru">возвратные глаголы</span>): -ся after a consonant
            (<span lang="ru">учился</span>), -сь after a vowel (<span lang="ru">училась, учусь</span>).
          </p>
        {/if}
        <p class="hint muted">
          An imperfective (<span lang="ru">несовершенный вид</span>) verb's forms are present tense; a perfective
          (<span lang="ru">совершенный вид</span>) verb's are future.
        </p>
      </fieldset>
    {:else if settings.mode === 'aspect'}
      <fieldset>
        <legend>Direction</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="dir" value="to-pf" bind:group={settings.aspect.direction} /> Imperfective → perfective <span class="ru" lang="ru">НСВ → СВ</span></label>
          <label class="chip"><input type="radio" name="dir" value="to-impf" bind:group={settings.aspect.direction} /> Perfective → imperfective <span class="ru" lang="ru">СВ → НСВ</span></label>
          <label class="chip"><input type="radio" name="dir" value="both" bind:group={settings.aspect.direction} /> Both</label>
        </div>
        <p class="hint muted">
          НСВ = <span lang="ru">несовершенный вид</span> (imperfective), СВ = <span lang="ru">совершенный вид</span> (perfective).
          Where a verb has several partners (<span lang="ru">видовые пары</span>), any of them is accepted.
        </p>
      </fieldset>
    {:else if settings.mode === 'adjectives'}
      <fieldset>
        <legend>Cases <span class="ru" lang="ru">падежи</span></legend>
        <div class="chips">
          {#each CASES as c (c)}
            <label class="chip">
              <input type="checkbox" checked={settings.adjectives.cases.includes(c)} onchange={() => (settings.adjectives.cases = toggle<Case>(settings.adjectives.cases, c))} />
              {CASE_TERM[c].en} <span class="ru" lang="ru">{CASE_TERM[c].ru.replace(' падеж', '')}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Number <span class="ru" lang="ru">число</span></legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="num" value="sg" bind:group={settings.adjectives.number} /> Singular <span class="ru" lang="ru">единственное</span></label>
          <label class="chip"><input type="radio" name="num" value="pl" bind:group={settings.adjectives.number} /> Plural <span class="ru" lang="ru">множественное</span></label>
          <label class="chip"><input type="radio" name="num" value="both" bind:group={settings.adjectives.number} /> Both</label>
        </div>
        <p class="hint muted">
          Nouns come from the 1,000 most frequent. Accusative (<span lang="ru">винительный падеж</span>) follows the noun's
          animacy (<span lang="ru">одушевлённость</span>).
        </p>
      </fieldset>
    {:else if settings.mode === 'short'}
      <p class="hint muted first">
        Type the short form (<span lang="ru">краткая форма</span>) that agrees with the pronoun: masculine
        (<span lang="ru">мужской род</span>), feminine (<span lang="ru">женский род</span>), neuter
        (<span lang="ru">средний род</span>) or plural (<span lang="ru">множественное число</span>). Watch the stress shifts.
      </p>
    {:else if settings.mode === 'compare'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          {#each COMPARE_TYPES as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.compare.types.includes(t.id)} onchange={() => (settings.compare.types = toggle(settings.compare.types, t.id))} />
              {t.label.en} <span class="ru" lang="ru">{t.label.ru}</span>
            </label>
          {/each}
        </div>
        <p class="hint muted">
          Comparatives and -ейший superlatives come from OpenRussian and Wiktionary; many adjectives have none.
          With самый, both words agree with the noun in the nominative (<span lang="ru">именительный падеж</span>).
        </p>
      </fieldset>
    {:else if settings.mode === 'adverbs'}
      <fieldset>
        <legend>Aspect <span class="ru" lang="ru">вид</span></legend>
        <div class="chips">
          <label class="chip">
            <input type="checkbox" checked={settings.adverbs.aspects.includes('impf')} onchange={() => (settings.adverbs.aspects = toggle(settings.adverbs.aspects, 'impf'))} />
            Imperfective → читая <span class="ru" lang="ru">{TERMS.advImpf.ru}</span>
          </label>
          <label class="chip">
            <input type="checkbox" checked={settings.adverbs.aspects.includes('pf')} onchange={() => (settings.adverbs.aspects = toggle(settings.adverbs.aspects, 'pf'))} />
            Perfective → прочитав <span class="ru" lang="ru">{TERMS.advPf.ru}</span>
          </label>
        </div>
        <p class="hint muted">Forms come from Wiktionary. Where -в and -вши both exist, -в is shown and -вши also accepted.</p>
      </fieldset>
    {:else if settings.mode === 'participles'}
      <fieldset>
        <legend>Participles <span class="ru" lang="ru">причастия</span></legend>
        <div class="chips">
          {#each PARTICIPLE_KINDS as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.participles.kinds.includes(t.id)} onchange={() => (settings.participles.kinds = toggle(settings.participles.kinds, t.id))} />
              {t.label.en} <span class="ru" lang="ru">{t.label.ru}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          {#each PARTICIPLE_TYPES as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.participles.types.includes(t.id)} onchange={() => (settings.participles.types = toggle(settings.participles.types, t.id))} />
              {t.label.en} <span class="ru" lang="ru">{t.label.ru}</span>
            </label>
          {/each}
        </div>
        <p class="hint muted">Present participles are drilled for imperfective verbs only. Short forms need the past passive participle.</p>
      </fieldset>
    {:else if settings.mode === 'numbers'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          {#each NUMBER_TYPES as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.numbers.types.includes(t.id)} onchange={() => (settings.numbers.types = toggle(settings.numbers.types, t.id))} />
              {t.label.en} <span class="ru" lang="ru">{t.label.ru}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Numbers</legend>
        <div class="chips">
          {#each NUMBER_RANGES as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.numbers.ranges.includes(t.id)} onchange={() => (settings.numbers.ranges = toggle(settings.numbers.ranges, t.id))} />
              {t.label}
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Cases <span class="ru" lang="ru">падежи</span></legend>
        <div class="chips">
          {#each CASES as c (c)}
            <label class="chip">
              <input type="checkbox" checked={settings.numbers.cases.includes(c)} onchange={() => (settings.numbers.cases = toggle<Case>(settings.numbers.cases, c))} />
              {CASE_TERM[c].en} <span class="ru" lang="ru">{CASE_TERM[c].ru.replace(' падеж', '')}</span>
            </label>
          {/each}
        </div>
        <p class="hint muted">Compound numbers (двадцать пять) aren't included yet. Nouns come from the 1,000 most frequent.</p>
      </fieldset>
    {:else if settings.mode === 'diminutives'}
      <fieldset>
        <legend>Direction</legend>
        <div class="chips">
          <label class="chip">
            <input type="checkbox" checked={settings.diminutives.directions.includes('to')} onchange={() => (settings.diminutives.directions = toggle(settings.diminutives.directions, 'to'))} />
            Noun → diminutive <span class="ru" lang="ru">{TERMS.diminutive.ru}</span>
          </label>
          <label class="chip">
            <input type="checkbox" checked={settings.diminutives.directions.includes('from')} onchange={() => (settings.diminutives.directions = toggle(settings.diminutives.directions, 'from'))} />
            Diminutive → noun <span class="ru" lang="ru">{TERMS.baseNoun.ru}</span>
          </label>
        </div>
        <p class="hint muted">Any diminutive Wiktionary lists is accepted (дом → домик or домок).</p>
      </fieldset>
    {:else if settings.mode === 'plurals'}
      <fieldset>
        <legend>Contexts</legend>
        <div class="chips">
          {#each PLURAL_CONTEXTS as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.plurals.contexts.includes(t.id)} onchange={() => (settings.plurals.contexts = toggle(settings.plurals.contexts, t.id))} />
              {t.label.en} <span class="ru" lang="ru">{t.label.ru}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      {#if settings.plurals.contexts.includes('cases')}
        <fieldset>
          <legend>Cases for “other cases” <span class="ru" lang="ru">падежи</span></legend>
          <div class="chips">
            {#each CASES.filter((c) => c !== 'nom') as c (c)}
              <label class="chip">
                <input type="checkbox" checked={settings.plurals.cases.includes(c)} onchange={() => (settings.plurals.cases = toggle<Case>(settings.plurals.cases, c))} />
                {CASE_TERM[c].en} <span class="ru" lang="ru">{CASE_TERM[c].ru.replace(' падеж', '')}</span>
              </label>
            {/each}
          </div>
        </fieldset>
      {/if}
    {:else}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          {#each MOTION_TYPES as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.motion.types.includes(t.id)} onchange={() => (settings.motion.types = toggle(settings.motion.types, t.id))} />
              {t.label.en} <span class="ru" lang="ru">{t.label.ru}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {/if}

    {#if settings.mode !== 'motion' && settings.mode !== 'numbers'}
      <fieldset>
        <legend>Vocabulary (by frequency)</legend>
        <div class="chips">
          {#each BANDS as b, i (b)}
            <label class="chip"><input type="radio" name="band" value={i} bind:group={settings.band} /> {b}</label>
          {/each}
        </div>
      </fieldset>
    {/if}

    <fieldset>
      <legend>Questions</legend>
      <div class="chips">
        {#each [10, 20, 40] as n (n)}
          <label class="chip"><input type="radio" name="count" value={n} bind:group={settings.count} /> {n}</label>
        {/each}
        <label class="chip"><input type="radio" name="count" value={0} bind:group={settings.count} /> Unlimited</label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Display</legend>
      <div class="chips">
        <label class="chip"><input type="checkbox" bind:checked={settings.stress} /> Stress marks <span class="ru" lang="ru">ударение</span></label>
        <label class="chip"><input type="checkbox" bind:checked={settings.keyboard} /> On-screen Cyrillic keyboard</label>
      </div>
    </fieldset>
  </div>

  <div class="go">
    <button class="btn primary start" type="submit" disabled={!!invalid || loading}>
      {loading ? 'Loading…' : 'Start'}
    </button>
    <p class="status" role="status" aria-live="polite">
      {#if invalid}<span class="err">{invalid}</span>{:else if error}<span class="err">{error}</span>{/if}
    </p>
  </div>
</form>

<style>
  fieldset {
    border: 0;
    margin: 0 0 18px;
    padding: 0;
    min-width: 0;
  }
  fieldset:last-child {
    margin-bottom: 0;
  }
  legend {
    font-weight: 700;
    margin-bottom: 8px;
    padding: 0;
  }
  .modes legend {
    font-size: 1.4rem;
    font-family: var(--serif);
  }
  .group {
    font-size: 1rem;
    margin: 14px 0 8px;
  }
  .group:first-of-type {
    margin-top: 0;
  }
  .first {
    margin: 0 0 18px;
  }
  .mode-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .mode {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--surface);
    cursor: pointer;
  }
  .mode input {
    position: absolute;
    opacity: 0;
    inset: 0;
    cursor: pointer;
  }
  .mode:has(input:focus-visible) {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
  }
  .mode.selected {
    border-color: var(--accent);
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .mode-title {
    font-weight: 700;
  }
  .mode-ru {
    font-family: var(--serif);
    font-size: 0.95rem;
  }
  .ru {
    font-family: var(--serif);
    color: var(--muted);
  }
  .mode-blurb {
    font-size: 0.9rem;
    color: var(--muted);
  }
  .options {
    margin-top: 6px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-2);
    cursor: pointer;
  }
  .chip:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .chip input {
    accent-color: var(--accent);
    margin: 0;
    width: 18px;
    height: 18px;
  }
  .hint {
    margin: 8px 0 0;
    font-size: 0.9rem;
  }
  .go {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 18px;
    flex-wrap: wrap;
  }
  .start {
    min-width: 160px;
    font-size: 1.1rem;
  }
  .status {
    margin: 0;
  }
  .err {
    color: var(--wrong);
  }
</style>

<script lang="ts">
  import { CASES, type Case, type VerbGroup } from '../shared/cells.ts';
  import { CASE_TERM, TERMS, type Term } from '../lib/terms.ts';
  import { TOPIC_GROUPS, isDrill, topicById } from '../lib/topics.ts';
  import { loadProgress, summarise, today } from '../lib/progress.ts';
  import { href } from '../lib/router.ts';
  import type { Settings } from '../lib/settings.ts';
  import type { WordPos } from '../shared/types.ts';
  import { settingsValid } from '../lib/start.ts';
  import type { CompareSettings, Mode, MotionSettings, TenseSettings, NegationSettings, ParticleTopicSettings, NumberSettings, ParticipleSettings, PluralSettings } from '../lib/types.ts';

  let { settings = $bindable(), loading, error, onstart, onback }: { settings: Settings; loading: boolean; error: string; onstart: () => void; onback: () => void } = $props();

  const topic = $derived(topicById(settings.mode));
  /** Topics a mixed review can include: every drill except the Review drills themselves. */
  const VOCAB_TYPES: { id: WordPos; en: string; ru: string }[] = [
    { id: 'n', en: 'Nouns', ru: 'существительные' },
    { id: 'v', en: 'Verbs', ru: 'глаголы' },
    { id: 'a', en: 'Adjectives', ru: 'прилагательные' },
    { id: 'o', en: 'Other words (prepositions, adverbs, pronouns…)', ru: 'другие слова' },
  ];
  const MIX_GROUPS = TOPIC_GROUPS.map((g) => ({ ...g, modes: g.modes.filter(isDrill).filter((t) => t.id !== 'mixed' && t.id !== 'translate' && t.id !== 'build') })).filter((g) => g.modes.length);
  const weak = $derived(settings.progress && settings.mode === 'mixed' ? summarise(loadProgress(), today()).weak.map((w) => w.mode) : []);
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
    { id: 'ordinal', label: TERMS.ordinal },
    { id: 'compound', label: TERMS.compound },
    { id: 'collective', label: TERMS.collective },
  ];
  const NUMBER_RANGES: { id: NumberSettings['ranges'][number]; label: string }[] = [
    { id: '1-4', label: '1–4 and оба' },
    { id: '5-20', label: '5–20' },
    { id: 'tens', label: '30–90, 100–900' },
  ];
  const NEGATION_KINDS: { id: NegationSettings['kinds'][number]; label: Term }[] = [
    { id: 'net', label: { en: 'нет / не было + genitive', ru: 'родительный падеж' } },
    { id: 'nipron', label: { en: 'никто / ничто in any case', ru: TERMS.negativePronoun.ru } },
    { id: 'ne-ni', label: { en: 'не or ни', ru: 'частицы не и ни' } },
  ];
  const PARTICLE_GROUPS: { id: ParticleTopicSettings['groups'][number]; label: string }[] = [
    { id: 'li', label: 'ли' },
    { id: 'zhe-ved', label: 'же, ведь' },
    { id: 'ne-ni', label: 'не / ни' },
    { id: 'colloquial', label: 'вот, ну, даже, только, -ка' },
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
  const SENTENCE_TENSES: { id: TenseSettings['tenses'][number]; label: Term }[] = [
    { id: 'presfut', label: TERMS.presfut },
    { id: 'past', label: TERMS.past },
    { id: 'imperative', label: TERMS.imperative },
    { id: 'inf', label: { en: 'Infinitive', ru: 'инфинитив' } },
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
  <header class="setup-head">
    <h1>Set up your drill</h1>
    {#if topic}
      <p class="chosen">
        You've chosen: <strong>{topic.title.en}</strong> (<span lang="ru">{topic.title.ru}</span>).
        <a href={href({ page: 'drill' })}>Choose a different drill</a>
      </p>
    {/if}
  </header>

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
    {:else if settings.mode === 'vocab'}
      <fieldset>
        <legend>Which way round</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="vdir" value="recognise" bind:group={settings.vocab.direction} /> Russian → English (choose the meaning)</label>
          <label class="chip"><input type="radio" name="vdir" value="recall" bind:group={settings.vocab.direction} /> English → Russian (type the word)</label>
          <label class="chip"><input type="radio" name="vdir" value="both" bind:group={settings.vocab.direction} /> Both</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Words</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="vsrc" value="common" bind:group={settings.vocab.source} /> The commonest words</label>
          <label class="chip"><input type="radio" name="vsrc" value="mine" bind:group={settings.vocab.source} /> My words that are due</label>
        </div>
        {#if settings.vocab.source === 'mine'}
          <p class="hint muted">
            {#if settings.progress}
              Your words come back on a schedule: right first time, and a word waits longer before it's asked again
              (1, 3, 7, 14, 30, then 60 days); wrong, and it's back tomorrow. See them on the <a href={href({ page: 'progress' })}>Progress page</a>.
            {:else}
              Krotik keeps your own word list only when progress is on (in this browser only). Turn it on on the <a href={href({ page: 'progress' })}>Progress page</a>.
            {/if}
          </p>
        {/if}
      </fieldset>
      {#if settings.vocab.source === 'common'}
        <fieldset>
          <legend>Kinds of word</legend>
          <div class="chips">
            {#each VOCAB_TYPES as t (t.id)}
              <label class="chip"><input type="checkbox" checked={settings.vocab.types.includes(t.id)} onchange={() => (settings.vocab.types = toggle(settings.vocab.types, t.id))} /> {t.en} <span class="ru" lang="ru">{t.ru}</span></label>
            {/each}
          </div>
          <p class="hint muted">
            Meanings are from the OpenRussian dictionary. In “English → Russian”, other words with the same meaning count as
            right too, and you'll see which.{#if settings.progress}{' '}Every word you answer goes into your words.{/if}
          </p>
        </fieldset>
      {/if}
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
        <p class="hint muted">
          Ranges apply to “decline” and “numeral + noun”. Ordinals agree with a noun; compound numbers (двадцать пять) and
          collective numerals (двое, трое) are declined on their own. Nouns come from the 1,000 most frequent.
        </p>
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
    {:else if settings.mode === 'pronouns'}
      <fieldset>
        <legend>Cases <span class="ru" lang="ru">падежи</span></legend>
        <div class="chips">
          {#each CASES.filter((c) => c !== 'nom') as c (c)}
            <label class="chip">
              <input type="checkbox" checked={settings.pronouns.cases.includes(c)} onchange={() => (settings.pronouns.cases = toggle<Case>(settings.pronouns.cases, c))} />
              {CASE_TERM[c].en} <span class="ru" lang="ru">{CASE_TERM[c].ru.replace(' падеж', '')}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Context</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.pronouns.prepositions.includes('plain')} onchange={() => (settings.pronouns.prepositions = toggle(settings.pronouns.prepositions, 'plain'))} /> On its own <span class="ru" lang="ru">его, ей</span></label>
          <label class="chip"><input type="checkbox" checked={settings.pronouns.prepositions.includes('afterPrep')} onchange={() => (settings.pronouns.prepositions = toggle(settings.pronouns.prepositions, 'afterPrep'))} /> After a preposition <span class="ru" lang="ru">у него, к ней</span></label>
        </div>
        <p class="hint muted">Includes я … они, себя, кто and что. Tables from Wiktionary.</p>
      </fieldset>
    {:else if settings.mode === 'possessives'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.possessives.types.includes('agree')} onchange={() => (settings.possessives.types = toggle(settings.possessives.types, 'agree'))} /> Agree with a noun <span class="ru" lang="ru">согласование</span></label>
          <label class="chip"><input type="checkbox" checked={settings.possessives.types.includes('svoy')} onchange={() => (settings.possessives.types = toggle(settings.possessives.types, 'svoy'))} /> свой or его/её/их <span class="ru" lang="ru">в предложениях</span></label>
        </div>
        <p class="hint muted">мой, твой, свой, наш, ваш, этот, тот, весь, чей, сам. свой/его is multiple choice in Tatoeba sentences.</p>
      </fieldset>
    {:else if settings.mode === 'nounCases'}
      <fieldset>
        <legend>Cases <span class="ru" lang="ru">падежи</span></legend>
        <div class="chips">
          {#each CASES as c (c)}
            <label class="chip">
              <input type="checkbox" checked={settings.nounCases.cases.includes(c)} onchange={() => (settings.nounCases.cases = toggle<Case>(settings.nounCases.cases, c))} />
              {CASE_TERM[c].en} <span class="ru" lang="ru">{CASE_TERM[c].ru.replace(' падеж', '')}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Number <span class="ru" lang="ru">число</span></legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="ncnum" value="sg" bind:group={settings.nounCases.number} /> Singular <span class="ru" lang="ru">единственное</span></label>
          <label class="chip"><input type="radio" name="ncnum" value="pl" bind:group={settings.nounCases.number} /> Plural <span class="ru" lang="ru">множественное</span></label>
          <label class="chip"><input type="radio" name="ncnum" value="both" bind:group={settings.nounCases.number} /> Both</label>
        </div>
      </fieldset>
    {:else if settings.mode === 'stress'}
      <fieldset>
        <legend>Words</legend>
        <div class="chips">
          {#each [['verbs', TERMS.verbs], ['nouns', TERMS.nouns], ['adjectives', TERMS.adjectives]] as [id, t] (id)}
            <label class="chip">
              <input type="checkbox" checked={settings.stressDrill.sources.includes(id as 'verbs')} onchange={() => (settings.stressDrill.sources = toggle(settings.stressDrill.sources, id as 'verbs'))} />
              {(t as Term).en} <span class="ru" lang="ru">{(t as Term).ru}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <fieldset>
        <legend>Forms</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="stforms" value="headword" bind:group={settings.stressDrill.forms} /> Dictionary forms</label>
          <label class="chip"><input type="radio" name="stforms" value="any" bind:group={settings.stressDrill.forms} /> Any form (stress often moves)</label>
        </div>
        <p class="hint muted">Words with ё are left out (ё is always stressed). Where both stresses are standard, either counts.</p>
      </fieldset>
    {:else if settings.mode === 'government'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.government.types.includes('choice')} onchange={() => (settings.government.types = toggle(settings.government.types, 'choice'))} /> Which case? <span class="ru" lang="ru">какой падеж?</span></label>
          <label class="chip"><input type="checkbox" checked={settings.government.types.includes('sentence')} onchange={() => (settings.government.types = toggle(settings.government.types, 'sentence'))} /> In sentences <span class="ru" lang="ru">в предложениях</span></label>
        </div>
        <p class="hint muted">The list of about 90 verbs and their cases is hand-made (curated/government.yaml); sentence examples come from Tatoeba.</p>
      </fieldset>
    {:else if settings.mode === 'alphabet'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.alphabet.types.includes('letters')} onchange={() => (settings.alphabet.types = toggle(settings.alphabet.types, 'letters'))} /> Letter → sound <span class="ru" lang="ru">буквы</span></label>
          <label class="chip"><input type="checkbox" checked={settings.alphabet.types.includes('read')} onchange={() => (settings.alphabet.types = toggle(settings.alphabet.types, 'read'))} /> Read a word <span class="ru" lang="ru">читать</span></label>
          <label class="chip"><input type="checkbox" checked={settings.alphabet.types.includes('write')} onchange={() => (settings.alphabet.types = toggle(settings.alphabet.types, 'write'))} /> Write a word <span class="ru" lang="ru">писать</span></label>
        </div>
        <p class="hint muted">Words are common nouns from the vocabulary you choose below. Writing uses the Cyrillic keyboard or phonetic typing.</p>
      </fieldset>
    {:else if settings.mode === 'narechiya'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.narechiya.types.includes('form')} onchange={() => (settings.narechiya.types = toggle(settings.narechiya.types, 'form'))} /> Adjective → adverb <span class="ru" lang="ru">быстрый → быстро</span></label>
          <label class="chip"><input type="checkbox" checked={settings.narechiya.types.includes('comparative')} onchange={() => (settings.narechiya.types = toggle(settings.narechiya.types, 'comparative'))} /> Comparative <span class="ru" lang="ru">быстрее</span></label>
          <label class="chip"><input type="checkbox" checked={settings.narechiya.types.includes('sentence')} onchange={() => (settings.narechiya.types = toggle(settings.narechiya.types, 'sentence'))} /> Adverb or adjective? (sentences) <span class="ru" lang="ru">хорошо или хороший?</span></label>
        </div>
        <p class="hint muted">Adverbs and their comparatives come from Wiktionary, paired with the adjective they come from; the sentences are from Tatoeba.</p>
      </fieldset>
    {:else if settings.mode === 'questionWords'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.questionWords.types.includes('table')} onchange={() => (settings.questionWords.types = toggle(settings.questionWords.types, 'table'))} /> Cases and agreement <span class="ru" lang="ru">кому, чью книгу</span></label>
          <label class="chip"><input type="checkbox" checked={settings.questionWords.types.includes('sentence')} onchange={() => (settings.questionWords.types = toggle(settings.questionWords.types, 'sentence'))} /> In real questions <span class="ru" lang="ru">в предложениях</span></label>
        </div>
        <p class="hint muted">кто and что in every case; чей and какой agreeing with a noun; and real questions from Tatoeba to complete.</p>
      </fieldset>
    {:else if settings.mode === 'ordinals'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.ordinals.types.includes('agree')} onchange={() => (settings.ordinals.types = toggle(settings.ordinals.types, 'agree'))} /> With a noun <span class="ru" lang="ru">на третьем этаже</span></label>
          <label class="chip"><input type="checkbox" checked={settings.ordinals.types.includes('dates')} onchange={() => (settings.ordinals.types = toggle(settings.ordinals.types, 'dates'))} /> Dates <span class="ru" lang="ru">пятого мая</span></label>
          <label class="chip"><input type="checkbox" checked={settings.ordinals.types.includes('centuries')} onchange={() => (settings.ordinals.types = toggle(settings.ordinals.types, 'centuries'))} /> Centuries <span class="ru" lang="ru">в двадцатом веке</span></label>
        </div>
        <p class="hint muted">Ordinals decline like adjectives; in a compound ordinal only the last word changes.</p>
      </fieldset>
    {:else if settings.mode === 'specialCases'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.specialCases.types.includes('form')} onchange={() => (settings.specialCases.types = toggle(settings.specialCases.types, 'form'))} /> в/на … or о …? <span class="ru" lang="ru">в лесу / о лесе</span></label>
          <label class="chip"><input type="checkbox" checked={settings.specialCases.types.includes('sentence')} onchange={() => (settings.specialCases.types = toggle(settings.specialCases.types, 'sentence'))} /> In sentences <span class="ru" lang="ru">в предложениях</span></label>
        </div>
        <p class="hint muted">About a hundred masculine nouns take a stressed -у/-ю after в and на (Wiktionary); after о they keep the ordinary -е.</p>
      </fieldset>
    {:else if settings.mode === 'prefixedMotion'}
      <fieldset>
        <legend>Question types</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.prefixedMotion.types.includes('meaning')} onchange={() => (settings.prefixedMotion.types = toggle(settings.prefixedMotion.types, 'meaning'))} /> Name the verb from its meaning <span class="ru" lang="ru">значение приставки</span></label>
          <label class="chip"><input type="checkbox" checked={settings.prefixedMotion.types.includes('pair')} onchange={() => (settings.prefixedMotion.types = toggle(settings.prefixedMotion.types, 'pair'))} /> Aspect partner <span class="ru" lang="ru">видовая пара</span></label>
          <label class="chip"><input type="checkbox" checked={settings.prefixedMotion.types.includes('conjugate')} onchange={() => (settings.prefixedMotion.types = toggle(settings.prefixedMotion.types, 'conjugate'))} /> Conjugate <span class="ru" lang="ru">спряжение</span></label>
        </div>
        <p class="hint muted">при-, у-, в-, вы-, за-, пере-, про-, под-, от-, до-, об-, раз- with eight motion verbs; only pairs found in the dictionary data.</p>
      </fieldset>
    {:else if ['position', 'impersonal', 'comparison', 'conjunctions', 'time'].includes(settings.mode)}
      <p class="hint muted first">
        Real sentences from Tatoeba with one word blanked; the English translation is the cue.
        {#if settings.mode === 'position' || settings.mode === 'conjunctions'}
          Choose the missing word.
        {:else}
          Type the missing word; its dictionary form is in brackets.
        {/if}
      </p>
    {:else if settings.mode === 'prepositions' || settings.mode === 'aspectContext'}
      <p class="hint muted first">
        Real sentences from Tatoeba with one word blanked; the English translation is the cue.
        {#if settings.mode === 'prepositions'}
          Type the noun after the preposition in the right case (<span lang="ru">падеж</span>); its dictionary form is in brackets.
        {:else}
          Choose the imperfective (<span lang="ru">несовершенный вид</span>) or perfective (<span lang="ru">совершенный вид</span>)
          verb, in the same form. Sometimes both are possible; only the sentence's own word counts.
        {/if}
      </p>
    {:else if settings.mode === 'kotoryi' || settings.mode === 'chtoby' || settings.mode === 'conditional' || settings.mode === 'indefinite'}
      <p class="hint muted first">
        Real sentences from Tatoeba with one word blanked; the English translation is the cue.
        {#if settings.mode === 'indefinite'}
          Pick the missing word from the options. Sometimes more than one could fit; only the sentence's own word counts.
        {:else}
          Type the missing word; the dictionary form is given in brackets.
        {/if}
      </p>
    {:else if settings.mode === 'negation'}
      <fieldset>
        <legend>Kinds <span class="ru" lang="ru">виды отрицания</span></legend>
        <div class="chips">
          {#each NEGATION_KINDS as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.negation.kinds.includes(t.id)} onchange={() => (settings.negation.kinds = toggle(settings.negation.kinds, t.id))} />
              {t.label.en} <span class="ru" lang="ru">{t.label.ru}</span>
            </label>
          {/each}
        </div>
        <p class="hint muted">The first two are typed; не vs ни is multiple choice.</p>
      </fieldset>
    {:else if settings.mode === 'particles'}
      <fieldset>
        <legend>Particles <span class="ru" lang="ru">частицы</span></legend>
        <div class="chips">
          {#each PARTICLE_GROUPS as t (t.id)}
            <label class="chip">
              <input type="checkbox" checked={settings.particles.groups.includes(t.id)} onchange={() => (settings.particles.groups = toggle(settings.particles.groups, t.id))} />
              <span lang="ru">{t.label}</span>
            </label>
          {/each}
        </div>
        <p class="hint muted">Multiple choice. Some particles overlap (же/ведь); the English translation is the cue, and only the sentence's own word counts.</p>
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
    {:else if settings.mode === 'mixed'}
      <fieldset>
        <legend>Topics <span class="ru" lang="ru">темы</span></legend>
        <p class="hint muted">Choose two or more. Each topic uses the settings you last chose for it on its own drill page.</p>
        {#if weak.length >= 2}
          <p><button type="button" class="btn small-btn" onclick={() => (settings.mixed.topics = weak.slice(0, 6))}>Use my weak topics ({weak.length})</button></p>
        {/if}
        {#each MIX_GROUPS as g (g.title.en)}
          <p class="mix-group">{g.title.en}</p>
          <div class="chips">
            {#each g.modes as t (t.id)}
              <label class="chip">
                <input type="checkbox" checked={settings.mixed.topics.includes(t.id)} onchange={() => (settings.mixed.topics = toggle<Mode>(settings.mixed.topics, t.id))} />
                {t.title.en}
              </label>
            {/each}
          </div>
        {/each}
      </fieldset>
    {:else if settings.mode === 'fix'}
      <fieldset>
        <legend>Levels</legend>
        <div class="chips">
          {#each ['A1', 'A2', 'B1', 'B2', 'C1'] as const as l (l)}
            <label class="chip"><input type="checkbox" checked={settings.fix.levels.includes(l)} onchange={() => (settings.fix.levels = toggle(settings.fix.levels, l))} /> {l}</label>
          {/each}
        </div>
        <p class="hint muted">
          A real sentence with one word in the wrong form (the wrong person, case, gender or number). Tap the wrong word,
          then type the right form. The sentences and the wrong forms are the Grammar test's, checked so the wrong one
          can't fit.
        </p>
      </fieldset>
    {:else if settings.mode === 'build'}
      <fieldset>
        <legend>Sentence length</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.build.lengths.includes('short')} onchange={() => (settings.build.lengths = toggle(settings.build.lengths, 'short'))} /> Short (3–5 words)</label>
          <label class="chip"><input type="checkbox" checked={settings.build.lengths.includes('long')} onchange={() => (settings.build.lengths = toggle(settings.build.lengths, 'long'))} /> Longer (6–9 words)</label>
        </div>
        <p class="hint muted">
          You'll see an English sentence and its Russian words in the wrong order: tap them in the right order. The
          original order is marked right; Russian word order is free, so if yours differs, compare it with the original
          and mark it yourself.
        </p>
      </fieldset>
    {:else if settings.mode === 'translate'}
      <fieldset>
        <legend>Which way round</legend>
        <div class="chips">
          <label class="chip"><input type="radio" name="tdir" value="en-ru" bind:group={settings.translate.direction} /> English → Russian</label>
          <label class="chip"><input type="radio" name="tdir" value="ru-en" bind:group={settings.translate.direction} /> Russian → English</label>
          <label class="chip"><input type="radio" name="tdir" value="both" bind:group={settings.translate.direction} /> Both</label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Sentence length</legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.translate.lengths.includes('short')} onchange={() => (settings.translate.lengths = toggle(settings.translate.lengths, 'short'))} /> Short (up to 5 words)</label>
          <label class="chip"><input type="checkbox" checked={settings.translate.lengths.includes('long')} onchange={() => (settings.translate.lengths = toggle(settings.translate.lengths, 'long'))} /> Longer (6–9 words)</label>
        </div>
        <p class="hint muted">
          You'll see a sentence; type it in the other language. Then compare yours with the real translation (from
          Tatoeba) and mark it yourself: other words and word orders can be just as right.
        </p>
      </fieldset>
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

    {#snippet tenseChips(chosen: string[], options: { id: string; label: Term }[], ontoggle: (id: string) => void)}
      <fieldset>
        <legend>Tenses <span class="ru" lang="ru">времена</span></legend>
        <div class="chips">
          {#each options as o (o.id)}
            <label class="chip">
              <input type="checkbox" checked={chosen.includes(o.id)} onchange={() => ontoggle(o.id)} />
              {o.label.en} <span class="ru" lang="ru">{o.label.ru}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    {/snippet}
    {#if settings.mode === 'motion' && settings.motion.types.includes('conjugate')}
      {@render tenseChips(settings.motion.groups ?? [], GROUPS, (id) => (settings.motion.groups = toggle(settings.motion.groups ?? [], id as VerbGroup)))}
    {:else if settings.mode === 'prefixedMotion' && settings.prefixedMotion.types.includes('conjugate')}
      {@render tenseChips(settings.prefixedMotion.groups ?? [], GROUPS, (id) => (settings.prefixedMotion.groups = toggle(settings.prefixedMotion.groups ?? [], id as VerbGroup)))}
    {:else if settings.mode === 'aspectContext' || settings.mode === 'position'}
      {@const key = settings.mode}
      {@render tenseChips(settings[key].tenses, SENTENCE_TENSES, (id) => (settings[key].tenses = toggle(settings[key].tenses, id as TenseSettings['tenses'][number])))}
    {:else if settings.mode === 'chtoby'}
      <fieldset>
        <legend>After чтобы <span class="ru" lang="ru">после чтобы</span></legend>
        <div class="chips">
          <label class="chip"><input type="checkbox" checked={settings.chtoby.kinds.includes('inf')} onchange={() => (settings.chtoby.kinds = toggle(settings.chtoby.kinds, 'inf'))} /> Infinitive (same subject) <span class="ru" lang="ru">инфинитив</span></label>
          <label class="chip"><input type="checkbox" checked={settings.chtoby.kinds.includes('past')} onchange={() => (settings.chtoby.kinds = toggle(settings.chtoby.kinds, 'past'))} /> Past tense (different subject) <span class="ru" lang="ru">прошедшее время</span></label>
        </div>
      </fieldset>
    {/if}

    {#if !(settings.mode === 'vocab' && settings.vocab.source === 'mine') && !['fix', 'motion', 'numbers', 'kotoryi', 'chtoby', 'conditional', 'negation', 'indefinite', 'particles', 'pronouns', 'possessives', 'prepositions', 'aspectContext', 'government', 'prefixedMotion', 'position', 'impersonal', 'comparison', 'conjunctions', 'time', 'questionWords', 'ordinals'].includes(settings.mode)}
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
        <label class="chip"><input type="checkbox" bind:checked={settings.translit} /> Phonetic typing (Latin → Cyrillic)</label>
      </div>
      {#if settings.translit}
        <p class="hint muted">sh → ш, zh → ж, ch → ч, shch → щ, kh → х, ya → я, yu → ю, yo → ё, e' → э, ' → ь, '' → ъ.</p>
      {/if}
    </fieldset>
  </div>

  <div class="go">
    <button class="btn primary start" type="submit" disabled={!!invalid || loading}>
      {loading ? 'Loading…' : 'Start'}
    </button>
    <button class="btn back" type="button" onclick={onback}>Back</button>
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
  .first {
    margin: 0 0 18px;
  }
  .setup-head h1 {
    font-family: var(--serif);
    margin: 4px 0 6px;
  }
  .chosen {
    margin: 0 0 16px;
    line-height: 1.6;
  }
  .ru {
    font-family: var(--serif);
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
  .mix-group {
    margin: 12px 0 6px;
    font-size: 0.9rem;
    font-weight: 700;
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
  /* White with black text, unlike the filled Start button. */
  .back {
    background: #fff;
    color: #090c13;
    font-size: 1.1rem;
  }
  .status {
    margin: 0;
  }
  .err {
    color: var(--wrong);
  }
</style>

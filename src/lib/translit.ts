/**
 * Phonetic typing: Latin → Cyrillic as you type. Each Latin letter maps to one Cyrillic letter, then
 * two-key combinations rewrite the previous letter: sh → ш, zh → ж, ch → ч, shch → щ, kh → х,
 * ya/ja → я, yu/ju → ю, yo/jo → ё, ye/je → е, e' → э, ' → ь, '' → ъ.
 * Trade-off: "сх", "зх", "цх", "кх" can't be typed this way (type the second letter as x for х: s+x → сх).
 */
const SINGLE: Record<string, string> = {
  a: 'а', b: 'б', v: 'в', w: 'в', g: 'г', d: 'д', e: 'е', z: 'з', i: 'и', j: 'й', k: 'к', l: 'л', m: 'м', n: 'н',
  o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', f: 'ф', h: 'х', x: 'х', c: 'ц', y: 'ы', "'": 'ь',
};
/** previous Cyrillic letter + typed Latin key → replacement for the previous letter */
const COMBO: Record<string, string> = {
  'сh': 'ш', 'зh': 'ж', 'цh': 'ч', 'кh': 'х', 'шч': 'щ',
  'ыa': 'я', 'йa': 'я', 'ыu': 'ю', 'йu': 'ю', 'ыo': 'ё', 'йo': 'ё', 'ыe': 'е', 'йe': 'е',
  "е'": 'э', "ь'": 'ъ',
};

export function toCyrillic(input: string): string {
  let out = '';
  for (const raw of input) {
    const lower = raw.toLowerCase();
    const isLatin = /[a-z']/.test(lower);
    if (!isLatin) {
      out += raw;
      continue;
    }
    const prev = out.slice(-1).toLowerCase();
    const combo = COMBO[prev + lower];
    if (combo) {
      out = out.slice(0, -1) + combo;
      // "shch": ш + c → шц, then h → шч → щ
      if (out.endsWith('шч')) out = out.slice(0, -2) + 'щ';
      continue;
    }
    out += SINGLE[lower] ?? raw;
    if (out.endsWith('шч')) out = out.slice(0, -2) + 'щ';
  }
  return out;
}

/**
 * A dialogue's review note ("<who>, YYYY-MM-DD", content/words/*.yaml) as a sentence. A reviewer who prefers not to be
 * named is "a native speaker": "Written for Krotik; checked by a native speaker on 8 November 2026."
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const REVIEWED = /^(.+), (\d{4})-(\d{2})-(\d{2})$/;

export function reviewedText(note: string): string {
  const m = REVIEWED.exec(note.trim());
  if (!m) return `Written for Krotik; checked by a native speaker (${note}).`;
  const [, who, y, mo, d] = m;
  const date = `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`;
  return /^a native speaker$/i.test(who!) ? `Written for Krotik; checked by a native speaker on ${date}.` : `Written for Krotik; checked by a native speaker (${who}) on ${date}.`;
}

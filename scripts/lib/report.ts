/** Collects counts, drop reasons and anomalies for reports/validation.md. */
export class Report {
  sections = new Map<string, { counts: Map<string, number>; drops: Map<string, string[]>; anomalies: Map<string, string[]>; notes: string[] }>();

  section(name: string) {
    let s = this.sections.get(name);
    if (!s) {
      s = { counts: new Map(), drops: new Map(), anomalies: new Map(), notes: [] };
      this.sections.set(name, s);
    }
    return s;
  }
  count(sec: string, key: string, n = 1) {
    const c = this.section(sec).counts;
    c.set(key, (c.get(key) ?? 0) + n);
  }
  drop(sec: string, reason: string, item: string) {
    push(this.section(sec).drops, reason, item);
  }
  anomaly(sec: string, kind: string, item: string) {
    push(this.section(sec).anomalies, kind, item);
  }
  note(sec: string, text: string) {
    this.section(sec).notes.push(text);
  }

  toMarkdown(title: string, preamble: string[], sample = 25): string {
    const out = [`# ${title}`, '', ...preamble, ''];
    for (const [name, s] of this.sections) {
      out.push(`## ${name}`, '');
      if (s.counts.size) {
        out.push('| count | n |', '|---|---:|');
        for (const [k, v] of s.counts) out.push(`| ${k} | ${v} |`);
        out.push('');
      }
      for (const n of s.notes) out.push(n, '');
      if (s.drops.size) {
        out.push('### Dropped', '');
        for (const [k, items] of [...s.drops].sort((a, b) => b[1].length - a[1].length)) {
          out.push(`- **${k}** (${items.length}): ${items.slice(0, sample).join(', ')}${items.length > sample ? ', …' : ''}`);
        }
        out.push('');
      }
      if (s.anomalies.size) {
        out.push('### Anomalies', '');
        for (const [k, items] of s.anomalies) {
          out.push(`- **${k}** (${items.length}): ${items.slice(0, sample).join('; ')}${items.length > sample ? '; …' : ''}`);
        }
        out.push('');
      }
    }
    return out.join('\n');
  }
}

function push(m: Map<string, string[]>, k: string, v: string) {
  const a = m.get(k);
  if (a) a.push(v);
  else m.set(k, [v]);
}

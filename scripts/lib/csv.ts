import { readFileSync } from 'node:fs';

/** OpenRussian exports: tab-separated, UTF-8, CRLF, no quoting, header row. */
export function readTsv(path: string): Record<string, string>[] {
  const lines = readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const header = lines.shift()!.split('\t');
  const rows: Record<string, string>[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split('\t');
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = (cols[i] ?? '').trim()));
    rows.push(row);
  }
  return rows;
}

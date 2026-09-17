/** Any answer shape (string, number, boolean, string[]) -> a list of trimmed, non-empty strings. */
export function answerValueToStrings(v: unknown): string[] {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return [String(v).trim()].filter(Boolean);
}

/** Bucket a value->count map into the top N entries plus a single "Other" row for the long tail. */
export function topAnswerRows(counts: Map<string, number>, cap = 8): { label: string; count: number }[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, cap).map(([label, count]) => ({ label, count }));
  const restCount = sorted.slice(cap).reduce((s, [, c]) => s + c, 0);
  return restCount > 0 ? [...top, { label: `Other (${sorted.length - cap})`, count: restCount }] : top;
}

/** True if most of a field's answers look like URLs/file links rather than short categorical values — not worth charting. */
export function looksLikeLinks(values: string[]): boolean {
  if (!values.length) return false;
  const linkish = values.filter((v) => /^https?:\/\//i.test(v)).length;
  return linkish / values.length > 0.5;
}

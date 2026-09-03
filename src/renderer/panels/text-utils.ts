/** Strips the compiler's inline markup down to plain reading text (decoding entities). */
export function stripToPlainText(value: string): string {
  return value
    .replace(/<n id="[^"]+"\/>/gu, '')
    .replace(/<s n="[^"]+"\/>/gu, '')
    .replace(/<\/?(?:wj|i|sc)>/gu, '')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&amp;/gu, '&');
}

/** Every case-insensitive occurrence of `needle` in `haystack`, as plain-text offset ranges. */
export function findAllOffsets(haystack: string, needle: string): Array<{ start: number; end: number }> {
  if (!needle) return [];
  const lowerHaystack = haystack.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const offsets: Array<{ start: number; end: number }> = [];
  let from = 0;
  for (;;) {
    const index = lowerHaystack.indexOf(lowerNeedle, from);
    if (index === -1) break;
    offsets.push({ start: index, end: index + lowerNeedle.length });
    from = index + lowerNeedle.length;
  }
  return offsets;
}

/**
 * Parses user search input into a small AST, then serialises that AST into an
 * FTS5 MATCH expression. User text is never concatenated into the MATCH
 * string directly (doc 08) — every leaf is quoted and escaped, so stray
 * quotes, parentheses or FTS5 keywords in the input can never change the
 * query's structure.
 *
 * Grammar (FR-SE-02): phrase `"..."`, boolean `AND`/`OR`/`NOT` (must be
 * upper-case to count as operators — lower-case `and`/`or`/`not` are literal
 * search terms), prefix `word*`, and bare words are implicitly ANDed
 * together. Precedence, tightest first: NOT/AND (left-associative, mixed
 * freely) then OR. Malformed fragments (dangling operators, empty phrases,
 * disallowed characters) are dropped rather than rejected outright; only a
 * query with no usable terms at all is an error.
 */

export type QueryNode =
  | { type: 'term'; value: string; prefix: boolean }
  | { type: 'phrase'; value: string }
  | { type: 'and'; left: QueryNode; right: QueryNode }
  | { type: 'or'; left: QueryNode; right: QueryNode }
  | { type: 'not'; left: QueryNode; right: QueryNode };

export interface ParsedSearchQuery {
  ok: true;
  match: string;
  ast: QueryNode;
}

export interface SearchQueryError {
  ok: false;
  error: string;
}

interface RawToken {
  kind: 'word' | 'phrase' | 'op';
  value: string;
}

/** Manual scan rather than a single regex, so an unterminated `"` degrades gracefully. */
function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = [];
  const length = input.length;
  let i = 0;

  while (i < length) {
    const ch = input[i]!;
    if (/\s/u.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"') {
      const close = input.indexOf('"', i + 1);
      const end = close === -1 ? length : close;
      const content = input.slice(i + 1, end).trim();
      if (content) tokens.push({ kind: 'phrase', value: content });
      i = close === -1 ? length : close + 1;
      continue;
    }
    let j = i;
    while (j < length && !/\s/u.test(input[j]!)) j += 1;
    const raw = input.slice(i, j);
    i = j;
    tokens.push(
      raw === 'AND' || raw === 'OR' || raw === 'NOT' ? { kind: 'op', value: raw } : { kind: 'word', value: raw },
    );
  }
  return tokens;
}

const TERM_CONTENT = /[\p{L}\p{N}'-]+/u;

function sanitizeTerm(raw: string): { value: string; prefix: boolean } | null {
  let working = raw.replace(/"/gu, '');
  let prefix = false;
  if (working.length > 1 && working.endsWith('*')) {
    prefix = true;
    working = working.slice(0, -1);
  }
  const match = TERM_CONTENT.exec(working);
  return match ? { value: match[0], prefix } : null;
}

type SigToken =
  | { kind: 'op'; op: 'AND' | 'OR' | 'NOT' }
  | { kind: 'term'; value: string; prefix: boolean }
  | { kind: 'phrase'; value: string };

/** Drops anything that can't become a valid MATCH leaf, keeping the parser total. */
function significantTokens(tokens: RawToken[]): SigToken[] {
  const out: SigToken[] = [];
  for (const token of tokens) {
    if (token.kind === 'op') {
      out.push({ kind: 'op', op: token.value as 'AND' | 'OR' | 'NOT' });
      continue;
    }
    if (token.kind === 'phrase') {
      out.push({ kind: 'phrase', value: token.value });
      continue;
    }
    const sanitized = sanitizeTerm(token.value);
    if (sanitized) out.push({ kind: 'term', value: sanitized.value, prefix: sanitized.prefix });
  }
  return out;
}

class Cursor {
  pos = 0;
  constructor(private readonly tokens: SigToken[]) {}
  peek(): SigToken | undefined {
    return this.tokens[this.pos];
  }
  next(): SigToken | undefined {
    return this.tokens[this.pos++];
  }
}

function parseOperand(cursor: Cursor): QueryNode | null {
  const token = cursor.peek();
  if (!token || token.kind === 'op') return null;
  cursor.next();
  return token.kind === 'phrase'
    ? { type: 'phrase', value: token.value }
    : { type: 'term', value: token.value, prefix: token.prefix };
}

/** Left-associative chain of AND/NOT, with adjacent operands implicitly ANDed. */
function parseCombined(cursor: Cursor): QueryNode | null {
  const first = parseOperand(cursor);
  if (!first) return null;
  let left: QueryNode = first;

  for (;;) {
    const token = cursor.peek();
    let kind: 'and' | 'not';

    if (token?.kind === 'op' && token.op === 'OR') break;
    if (token?.kind === 'op' && token.op === 'AND') {
      kind = 'and';
      cursor.next();
    } else if (token?.kind === 'op' && token.op === 'NOT') {
      kind = 'not';
      cursor.next();
    } else if (token) {
      kind = 'and'; // implicit AND — the token itself is the next operand
    } else {
      break;
    }

    const right = parseOperand(cursor);
    if (!right) break; // dangling operator: drop it and stop this chain
    left = { type: kind, left, right };
  }
  return left;
}

function parseOr(cursor: Cursor): QueryNode | null {
  let left = parseCombined(cursor);
  for (;;) {
    const token = cursor.peek();
    if (token?.kind !== 'op' || token.op !== 'OR') break;
    cursor.next();
    const right = parseCombined(cursor);
    if (!right) break;
    left = left ? { type: 'or', left, right } : right;
  }
  return left;
}

function escape(value: string): string {
  return value.replace(/"/gu, '""');
}

function serialize(node: QueryNode): string {
  switch (node.type) {
    case 'term':
      return node.prefix ? `"${escape(node.value)}"*` : `"${escape(node.value)}"`;
    case 'phrase':
      return `"${escape(node.value)}"`;
    case 'and':
      return `(${serialize(node.left)} AND ${serialize(node.right)})`;
    case 'or':
      return `(${serialize(node.left)} OR ${serialize(node.right)})`;
    case 'not':
      return `(${serialize(node.left)} NOT ${serialize(node.right)})`;
  }
}

export function parseSearchQuery(input: string): ParsedSearchQuery | SearchQueryError {
  const ast = parseOr(new Cursor(significantTokens(tokenize(input))));
  if (!ast) return { ok: false, error: 'Enter a search term.' };
  return { ok: true, match: serialize(ast), ast };
}

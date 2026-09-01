import type { BookId } from '@shared/reference/canon.js';

/** One inline run of verse text, already reduced to our restricted markup. */
export type InlineText = string;

export interface ParsedVerse {
  chapter: number;
  verse: number;
  text: InlineText;
  /** True when this verse starts a new paragraph. */
  paraStart: boolean;
  /** Poetry indent level from \q1..\q4, or 0 when not poetry. */
  poetry: number;
}

export interface ParsedHeading {
  chapter: number;
  /** Verse the heading precedes. */
  verse: number;
  level: number;
  text: string;
}

export interface ParsedFootnote {
  id: string;
  chapter: number;
  verse: number;
  marker: string;
  text: string;
}

export interface ParsedCrossRef {
  chapter: number;
  verse: number;
  text: string;
}

export interface ParsedBook {
  id: BookId;
  /** \h — running header, usually the short book name. */
  shortName: string | null;
  /** \mt — main title as printed. */
  title: string | null;
  verses: ParsedVerse[];
  headings: ParsedHeading[];
  footnotes: ParsedFootnote[];
  crossRefs: ParsedCrossRef[];
}

export interface ParseDiagnostic {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  line: number;
}

export interface ParseOutcome {
  book: ParsedBook | null;
  diagnostics: ParseDiagnostic[];
}

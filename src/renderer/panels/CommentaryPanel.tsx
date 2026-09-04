import { Plus, ChevronDown, Trash2, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import LinkExtension from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import SubscriptExtension from '@tiptap/extension-subscript';
import SuperscriptExtension from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import UnderlineExtension from '@tiptap/extension-underline';
import { useEditor } from '@tiptap/react';
import { formatReference, fromVerseKey } from '@shared/reference/index.js';
import type { NoteRecord, NotebookRecord } from '@shared/ipc/contracts.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import { useWorkspace } from '../workspace/store.js';
import type { PanelProps } from './registry.js';

const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ];
  },
});

/**
 * Personal Commentary panel: a verse-keyed commentary authored by the user.
 * Entries are keyed to single verses or ranges and render all entries covering
 * the current verse (FR-NT-09/10/11/12).
 */
export function CommentaryPanel({ tabId, state }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const openOrNavigateBible = useWorkspace((store) => store.openOrNavigateBible);
  const syncSetId = useWorkspace((store) => store.workspace.tabs[tabId]?.syncSet ?? null);
  const syncId = useWorkspace((store) =>
    syncSetId ? store.workspace.syncSets[syncSetId]?.verseKey ?? null : null,
  );
  const stateVerseKey =
    typeof state === 'object' && state !== null && !Array.isArray(state)
      ? typeof state['verseKey'] === 'number'
        ? state['verseKey']
        : null
      : null;
  const currentVerseKey = syncId ?? stateVerseKey;

  useVerseSync({ tabId, containerRef });

  const [commentaries, setCommentaries] = useState<NotebookRecord[]>([]);
  const [selectedCommentaryId, setSelectedCommentaryId] = useState<string | null>(null);
  const [entries, setEntries] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Fetch personal commentaries (notebooks where kind === 'commentary') on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void window.versescape.annotations
      .listNotebooks()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          // Filter to only commentary notebooks
          const commentaryNotebooks = (result.data as NotebookRecord[]).filter(
            (nb) => nb.kind === 'commentary',
          );
          setCommentaries(commentaryNotebooks);
          if (commentaryNotebooks.length > 0 && !selectedCommentaryId) {
            setSelectedCommentaryId(commentaryNotebooks[0]?.id ?? null);
          }
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch entries for the current verse when it changes or commentary is selected
  useEffect(() => {
    if (!selectedCommentaryId || currentVerseKey === null) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    void window.versescape.annotations
      .listNotes({ start: currentVerseKey, end: currentVerseKey })
      .then((result) => {
        if (!cancelled && result.ok) {
          // Filter to only entries in the selected commentary notebook
          const relevantEntries = result.data.filter((note) => note.notebookId === selectedCommentaryId);
          setEntries(relevantEntries);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCommentaryId, currentVerseKey]);

  const currentVerse = currentVerseKey ? fromVerseKey(currentVerseKey) : null;
  const currentVerseRef = currentVerse
    ? formatReference({ start: currentVerse, end: currentVerse })
    : '—';

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      SubscriptExtension,
      SuperscriptExtension,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: '',
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const firstEntry = entries[0];
    editor.commands.setContent(firstEntry?.bodyMd ?? '', false);
  }, [editor, entries]);

  const createCommentaryEntry = (): void => {
    if (!selectedCommentaryId || currentVerseKey === null) return;
    void window.versescape.annotations
      .createNote({
        verseKey: currentVerseKey,
        title: `Entry for ${currentVerseRef}`,
        resourceId: 'bsb',
        notebookId: selectedCommentaryId,
      })
      .then((result) => {
        if (result.ok) {
          // Entry is automatically anchored during creation
          setEntries((prev) => [result.data, ...prev]);
        }
      });
  };

  const toggleExpand = (entryId: string): void => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const openEntry = (entry: NoteRecord): void => {
    // For now, just open the Bible to the entry's anchor verse
    // In the future, this could highlight the entry or open commentary panel
    if (entry.verseKey) {
      const start = fromVerseKey(entry.verseKey);
      if (start) {
        openOrNavigateBible({
          reference: formatReference({ start, end: start }),
          verseKey: entry.verseKey,
          resourceId: 'bsb',
        });
      }
    }
  };

  const deleteEntry = (entryId: string): void => {
    void window.versescape.annotations
      .deleteNote({ id: entryId })
      .then((result) => {
        if (result.ok) {
          setEntries((prev) => prev.filter((e) => e.id !== entryId));
        }
      });
  };

  return (
    <div className="personal-commentary-panel" ref={containerRef}>
      <div className="personal-commentary-panel__toolbar">
        <span className="personal-commentary-panel__title">Commentary</span>
        <select
          className="personal-commentary-panel__select"
          value={selectedCommentaryId ?? ''}
          onChange={(e) => setSelectedCommentaryId(e.target.value || null)}
        >
          <option value="">Select a commentary</option>
          {commentaries.map((commentary) => (
            <option key={commentary.id} value={commentary.id}>
              {commentary.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="personal-commentary-panel__button"
          title="Create entry for this verse"
          aria-label="Create entry"
          disabled={selectedCommentaryId === null || currentVerseKey === null}
          onClick={createCommentaryEntry}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="personal-commentary-panel__workspace">
        <section className="personal-commentary-panel__entries" aria-label="Commentary entries">
          {loading && <div className="personal-commentary-panel__empty">Loading…</div>}
          {!loading && selectedCommentaryId === null && (
            <div className="personal-commentary-panel__empty">Select a commentary to begin.</div>
          )}
          {!loading && selectedCommentaryId !== null && entries.length === 0 && (
            <div className="personal-commentary-panel__empty">
              No entries for {currentVerseRef}. Create one to get started.
            </div>
          )}
          {!loading &&
            entries.map((entry) => {
              const isExpanded = expandedEntries.has(entry.id);

              return (
                <div key={entry.id} className="personal-commentary-panel__entry">
                  <div
                    className="personal-commentary-panel__entry-header"
                    onClick={() => toggleExpand(entry.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <ChevronDown
                      size={14}
                      className={isExpanded ? 'personal-commentary-panel__chevron--open' : ''}
                    />
                    <span className="personal-commentary-panel__entry-reference">{entry.title}</span>
                    <button
                      type="button"
                      className="personal-commentary-panel__entry-link"
                      title="Open entry"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEntry(entry);
                      }}
                    >
                      <ExternalLink size={12} />
                    </button>
                    <button
                      type="button"
                      className="personal-commentary-panel__entry-delete"
                      title="Delete entry"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEntry(entry.id);
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div
                      className="personal-commentary-panel__entry-content"
                      dangerouslySetInnerHTML={{ __html: entry.bodyMd ?? '' }}
                    />
                  )}
                </div>
              );
            })}
        </section>
      </div>
    </div>
  );
}

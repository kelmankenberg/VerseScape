import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Ellipsis,
  ExternalLink,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link,
  List,
  ListOrdered,
  Plus,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
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
import { EditorContent, useEditor } from '@tiptap/react';
import { formatReference, fromVerseKey, parseReference, rangeToKeys } from '@shared/reference/index.js';
import type { NoteAnchorRecord, NoteRecord } from '@shared/ipc/contracts.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import { useWorkspace } from '../workspace/store.js';
import type { PanelProps } from './registry.js';
import { stripToPlainText } from './text-utils.js';

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
 * Notes panel: displays and manages notes anchored to the current verse.
 * Joins the sync set so it follows synced verse navigation (FR-NT-06).
 */
export function NotesPanel({ tabId, state, setState }: PanelProps): React.JSX.Element {
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
  const currentResourceId =
    typeof state === 'object' && state !== null && !Array.isArray(state) && typeof state['resourceId'] === 'string'
      ? state['resourceId']
      : 'bsb';
  const requestedNoteId =
    typeof state === 'object' && state !== null && !Array.isArray(state)
      ? typeof state['noteId'] === 'string'
        ? state['noteId']
        : null
      : null;
  useVerseSync({ tabId, containerRef });
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [anchors, setAnchors] = useState<NoteAnchorRecord[]>([]);
  const [anchorTexts, setAnchorTexts] = useState<Map<string, string>>(new Map());
  const [selectedAnchorKey, setSelectedAnchorKey] = useState<string | null>(null);
  const [addAnchorOpen, setAddAnchorOpen] = useState(false);
  const [anchorMode, setAnchorMode] = useState<'active' | 'custom'>('active');
  const [customAnchorReference, setCustomAnchorReference] = useState('');
  const [anchorError, setAnchorError] = useState<string | null>(null);
  const [anchorsOpen, setAnchorsOpen] = useState(true);
  const [showFullAnchorText, setShowFullAnchorText] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // When sync verse changes, refresh notes for that verse
  useEffect(() => {
    if (currentVerseKey === null) return;

    let cancelled = false;
    setLoading(true);
    void window.versescape.annotations
      .listNotes({})
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setNotes(result.data);
          setSelectedNoteId(
            requestedNoteId && result.data.some((note) => note.id === requestedNoteId)
              ? requestedNoteId
              : result.data[0]?.id ?? null,
          );
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentVerseKey, requestedNoteId]);

  useEffect(() => {
    if (!selectedNoteId) {
      setAnchors([]);
      setSelectedAnchorKey(null);
      return;
    }
    setSelectedAnchorKey(null);
    let cancelled = false;
    void window.versescape.annotations.listNoteAnchors({ id: selectedNoteId }).then((result) => {
      if (!cancelled && result.ok) setAnchors(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedNoteId]);

  useEffect(() => {
    if (anchors.length === 0) {
      setAnchorTexts(new Map());
      return;
    }
    let cancelled = false;
    void Promise.all(
      anchors.map(async (anchor) => {
        const start = fromVerseKey(anchor.startKey);
        const end = fromVerseKey(anchor.endKey);
        if (!start || !end) return [`${anchor.startKey}-${anchor.endKey}`, ''] as const;
        const chapterIds = [...new Set([start.chapter, end.chapter])];
        const results = await Promise.all(
          chapterIds.map((chapter) =>
            window.versescape.resources.getChapter({
              resourceId: anchor.resourceId ?? 'bsb',
              bookId: start.book,
              chapter,
            }),
          ),
        );
        const text = results
          .filter((result) => result.ok)
          .flatMap((result) => (result.ok ? result.data.verses : []))
          .filter((verse) => verse.key >= anchor.startKey && verse.key <= anchor.endKey)
          .map((verse) => stripToPlainText(verse.text))
          .join(' ');
        return [`${anchor.startKey}-${anchor.endKey}`, text] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setAnchorTexts(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [anchors]);

  const currentVerse = currentVerseKey ? fromVerseKey(currentVerseKey) : null;
  const currentVerseRef = currentVerse
    ? formatReference({ start: currentVerse, end: currentVerse })
    : '—';

  const toggleExpand = (noteId: string): void => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const createAnchoredNote = (): void => {
    if (currentVerseKey === null) return;
    void window.versescape.annotations
      .createNote({
        verseKey: currentVerseKey,
        title: 'New note',
        resourceId: currentResourceId,
      })
      .then((result) => {
        if (result.ok) {
          setNotes((previous) => [result.data, ...previous]);
          setSelectedNoteId(result.data.id);
        }
      });
  };

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

  const openAnchor = (anchor: NoteAnchorRecord): void => {
    const start = fromVerseKey(anchor.startKey);
    const end = fromVerseKey(anchor.endKey);
    if (!start || !end) return;
    openOrNavigateBible({
      reference: formatReference({ start, end }),
      verseKey: anchor.startKey,
      resourceId: anchor.resourceId ?? 'bsb',
    });
  };

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
    content: selectedNote?.bodyMd ?? '',
    immediatelyRender: false,
    onUpdate: ({ editor: changedEditor }) => {
      if (!selectedNoteId) return;
      const noteId = selectedNoteId;
      const bodyMd = changedEditor.getHTML();
      setNotes((previous) =>
        previous.map((note) => (note.id === noteId ? { ...note, bodyMd } : note)),
      );
      void window.versescape.annotations.updateNote({ id: noteId, bodyMd });
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(selectedNote?.bodyMd ?? '', false);
  }, [editor, selectedNoteId]);

  const setFontSize = (fontSize: string): void => {
    editor?.chain().focus().setMark('textStyle', { fontSize }).run();
  };

  const setLink = (): void => {
    const url = window.prompt('Enter a URL');
    if (url) editor?.chain().focus().setLink({ href: url }).run();
  };

  const addAnchor = (): void => {
    if (!selectedNoteId) return;
    if (anchorMode === 'active' && currentVerseKey === null) {
      setAnchorError('There is no active reference to anchor.');
      return;
    }
    const parsed = anchorMode === 'active' ? null : parseReference(customAnchorReference);
    if (anchorMode === 'custom' && (!parsed || !parsed.ok)) {
      setAnchorError('Enter a valid reference, such as John 3:16.');
      return;
    }
    const range =
      parsed && parsed.ok
        ? rangeToKeys(parsed.range)
        : { start: currentVerseKey as number, end: currentVerseKey as number };
    setAnchorError(null);
    void window.versescape.annotations
      .addNoteAnchor({
        noteId: selectedNoteId,
        startKey: range.start,
        endKey: range.end,
        resourceId: currentResourceId,
      })
      .then((result) => {
        if (result.ok) {
          setAnchors((previous) =>
            previous.some(
              (anchor) => anchor.startKey === result.data.startKey && anchor.endKey === result.data.endKey,
            )
              ? previous
              : [...previous, result.data],
          );
          setAddAnchorOpen(false);
          setCustomAnchorReference('');
        }
      });
  };

  const removeAnchor = (anchor: NoteAnchorRecord): void => {
    void window.versescape.annotations
      .deleteNoteAnchor({ noteId: anchor.noteId, startKey: anchor.startKey, endKey: anchor.endKey })
      .then((result) => {
        if (result.ok) {
          setAnchors((previous) =>
            previous.filter(
              (item) => item.startKey !== anchor.startKey || item.endKey !== anchor.endKey,
            ),
          );
          setSelectedAnchorKey(null);
        }
      });
  };

  const closeNote = (): void => {
    setSelectedNoteId(null);
    setMoreOpen(false);
  };

  const removeNote = (): void => {
    const noteId = selectedNoteId;
    if (!noteId) return;
    void window.versescape.annotations.deleteNote({ id: noteId }).then((result) => {
      if (!result.ok) return;
      setNotes((previous) => {
        const remaining = previous.filter((note) => note.id !== noteId);
        setSelectedNoteId(remaining[0]?.id ?? null);
        return remaining;
      });
      setState({ verseKey: currentVerseKey ?? 0 });
      setMoreOpen(false);
    });
  };

  return (
    <div className="notes-panel">
      <div className="notes-panel__toolbar">
        <span className="notes-panel__title">Notes</span>
        <span className="notes-panel__verse">{currentVerseRef}</span>
        <button
          type="button"
          className="notes-panel__button"
          title="Create a new note"
          aria-label="Create note"
          disabled={currentVerseKey === null}
          onClick={createAnchoredNote}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="notes-panel__workspace">
        <div ref={containerRef} className="notes-panel__list">
          {loading && <div className="notes-panel__empty">Loading notes…</div>}
          {!loading && notes.length === 0 && (
            <div className="notes-panel__empty">No notes for this verse yet.</div>
          )}
          {!loading &&
            notes.map((note) => (
              <div key={note.id} className="notes-panel__note">
                <button
                  type="button"
                  className={`notes-panel__note-header${selectedNoteId === note.id ? ' notes-panel__note-header--selected' : ''}`}
                  onClick={() => {
                    setSelectedNoteId(note.id);
                    toggleExpand(note.id);
                  }}
                >
                  <ChevronDown
                    size={14}
                    className={expandedNotes.has(note.id) ? 'notes-panel__chevron--open' : ''}
                  />
                  <span className="notes-panel__note-title">{note.title}</span>
                  <span className="notes-panel__note-date">Today</span>
                </button>
                {expandedNotes.has(note.id) && (
                  <div className="notes-panel__note-body">
                    <span>{currentVerseRef}</span>
                  </div>
                )}
              </div>
            ))}
        </div>
        <section className="notes-panel__editor" aria-label="Note editor">
          {selectedNote ? (
            <>
              <div className="notes-panel__editor-toolbar">
                <select
                  aria-label="Text style"
                  title="Text style"
                  defaultValue="paragraph"
                  onChange={(event) => {
                    if (event.target.value === 'heading') {
                      editor?.chain().focus().toggleHeading({ level: 2 }).run();
                    } else {
                      editor?.chain().focus().setParagraph().run();
                    }
                  }}
                >
                  <option value="paragraph">Default</option>
                  <option value="heading">Heading</option>
                </select>
                <select
                  aria-label="Font size"
                  title="Font size"
                  defaultValue="14px"
                  onChange={(event) => setFontSize(event.target.value)}
                >
                  <option value="11px">11</option>
                  <option value="14px">14</option>
                  <option value="16px">16</option>
                  <option value="20px">20</option>
                </select>
                <button type="button" aria-label="Bold" title="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}>
                  <Bold size={15} />
                </button>
                <button type="button" aria-label="Italic" title="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                  <Italic size={15} />
                </button>
                <button type="button" aria-label="Underline" title="Underline" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
                  <Underline size={15} />
                </button>
                <button type="button" aria-label="Strikethrough" title="Strikethrough" onClick={() => editor?.chain().focus().toggleStrike().run()}>
                  <Strikethrough size={15} />
                </button>
                <label className="notes-panel__format-color" title="Text color">
                  <span aria-hidden="true">A</span>
                  <input
                    aria-label="Text color"
                    type="color"
                    defaultValue="#e6e9ef"
                    onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
                  />
                </label>
                <button type="button" aria-label="Highlight" title="Highlight" onClick={() => editor?.chain().focus().toggleHighlight({ color: '#fde68a' }).run()}>
                  <Highlighter size={15} />
                </button>
                <button type="button" aria-label="Align left" title="Align left" onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
                  <AlignLeft size={15} />
                </button>
                <button type="button" aria-label="Align center" title="Align center" onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
                  <AlignCenter size={15} />
                </button>
                <button type="button" aria-label="Align right" title="Align right" onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
                  <AlignRight size={15} />
                </button>
                <button type="button" aria-label="Bulleted list" title="Bulleted list" onClick={() => editor?.chain().focus().toggleBulletList().run()}>
                  <List size={15} />
                </button>
                <button type="button" aria-label="Numbered list" title="Numbered list" onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
                  <ListOrdered size={15} />
                </button>
                <button type="button" aria-label="Decrease indent" title="Decrease indent" onClick={() => editor?.chain().focus().liftListItem('listItem').run()}>
                  <IndentDecrease size={15} />
                </button>
                <button type="button" aria-label="Increase indent" title="Increase indent" onClick={() => editor?.chain().focus().sinkListItem('listItem').run()}>
                  <IndentIncrease size={15} />
                </button>
                <button type="button" aria-label="Insert link" title="Insert link" onClick={setLink}>
                  <Link size={15} />
                </button>
                <button type="button" aria-label="Subscript" title="Subscript" onClick={() => editor?.chain().focus().toggleSubscript().run()}>
                  <Subscript size={15} />
                </button>
                <button type="button" aria-label="Superscript" title="Superscript" onClick={() => editor?.chain().focus().toggleSuperscript().run()}>
                  <Superscript size={15} />
                </button>
                <button type="button" aria-label="Clear formatting" title="Clear formatting" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}>
                  <RemoveFormatting size={15} />
                </button>
                <span className="notes-panel__editor-reference">{currentVerseRef}</span>
                <div className="notes-panel__more">
                  <button
                    type="button"
                    className="notes-panel__more-button"
                    aria-label="More note actions"
                    aria-expanded={moreOpen}
                    title="More note actions"
                    onClick={() => setMoreOpen((open) => !open)}
                  >
                    <Ellipsis size={17} />
                  </button>
                  {moreOpen && (
                    <div className="notes-panel__more-menu" role="menu">
                      <button type="button" role="menuitem" onClick={closeNote}>
                        <X size={14} />
                        Close this note
                      </button>
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={showFullAnchorText}
                        onClick={() => setShowFullAnchorText((shown) => !shown)}
                      >
                        <span className="notes-panel__menu-check">
                          {showFullAnchorText ? '✓' : ''}
                        </span>
                        Show full anchor text
                      </button>
                      <div className="notes-panel__menu-divider" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setAddAnchorOpen(true);
                          setMoreOpen(false);
                        }}
                      >
                        <Plus size={14} />
                        Add anchor
                      </button>
                      <button type="button" role="menuitem" onClick={removeNote}>
                        <Trash2 size={14} />
                        Delete this note
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="notes-panel__anchors">
                <button
                  type="button"
                  className="notes-panel__anchors-heading"
                  aria-expanded={anchorsOpen}
                  onClick={() => setAnchorsOpen((open) => !open)}
                >
                  <ChevronDown className={anchorsOpen ? 'notes-panel__chevron--open' : ''} size={14} />
                  <strong>Anchors</strong>
                </button>
                {anchorsOpen && (
                  <div className="notes-panel__anchor-list">
                    {anchors.map((anchor) => {
                      const start = fromVerseKey(anchor.startKey);
                      const end = fromVerseKey(anchor.endKey);
                      const label = start && end
                        ? formatReference({ start, end })
                        : `${anchor.startKey}-${anchor.endKey}`;
                      const anchorKey = `${anchor.startKey}-${anchor.endKey}`;
                      const selected = selectedAnchorKey === anchorKey;
                      return (
                        <div
                          className={`notes-panel__anchor${selected ? ' notes-panel__anchor--selected' : ''}`}
                          key={`${anchor.noteId}-${anchorKey}`}
                          onClick={() => setSelectedAnchorKey(anchorKey)}
                        >
                          <a
                            href={`#verse-${anchor.startKey}`}
                            title={label}
                            aria-describedby={`anchor-tooltip-${anchorKey}`}
                            onClick={(event) => {
                              event.preventDefault();
                              openAnchor(anchor);
                            }}
                          >
                            {label}
                          </a>
                          <span
                            id={`anchor-tooltip-${anchorKey}`}
                            className="notes-panel__anchor-tooltip"
                            role="tooltip"
                          >
                            <span className="notes-panel__anchor-tooltip-reference">{label}</span>
                            <span className="notes-panel__anchor-tooltip-text">
                              {anchorTexts.get(anchorKey) || 'Loading anchored text...'}
                            </span>
                          </span>
                          {showFullAnchorText && (
                            <span className="notes-panel__anchor-text">
                              {anchorTexts.get(anchorKey) || 'Loading anchored text...'}
                            </span>
                          )}
                          {selected ? (
                            <button
                              type="button"
                              className="notes-panel__delete-anchor"
                              aria-label={`Delete anchor ${label}`}
                              title={`Delete anchor ${label}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                removeAnchor(anchor);
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : (
                            <ExternalLink size={12} aria-hidden />
                          )}
                        </div>
                      );
                    })}
                    {!addAnchorOpen && (
                      <button type="button" className="notes-panel__add-anchor" onClick={() => setAddAnchorOpen(true)}>
                        <Plus size={13} />
                        Add anchor
                      </button>
                    )}
                    {addAnchorOpen && (
                      <div className="notes-panel__anchor-form">
                        <strong>Add anchor</strong>
                        <label>
                          <input
                            type="radio"
                            name={`anchor-mode-${selectedNote.id}`}
                            checked={anchorMode === 'active'}
                            onChange={() => {
                              setAnchorMode('active');
                              setAnchorError(null);
                            }}
                          />
                          Active Reference: {currentVerseRef}
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`anchor-mode-${selectedNote.id}`}
                            checked={anchorMode === 'custom'}
                            onChange={() => {
                              setAnchorMode('custom');
                              setAnchorError(null);
                            }}
                          />
                          Reference
                        </label>
                        <input
                          className="notes-panel__anchor-reference"
                          aria-label="Anchor reference"
                          placeholder="Reference"
                          disabled={anchorMode !== 'custom'}
                          value={customAnchorReference}
                          onChange={(event) => setCustomAnchorReference(event.target.value)}
                        />
                        {anchorError && <div className="notes-panel__anchor-error">{anchorError}</div>}
                        <div className="notes-panel__anchor-actions">
                          <button type="button" onClick={() => setAddAnchorOpen(false)}>Cancel</button>
                          <button type="button" className="notes-panel__anchor-done" onClick={addAnchor}>Done</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <EditorContent
                key={selectedNote.id}
                editor={editor}
                className="notes-panel__editor-input"
                aria-label={`Edit ${selectedNote.title}`}
              />
            </>
          ) : (
            <div className="notes-panel__editor-empty">Select a note to edit it.</div>
          )}
        </section>
      </div>
    </div>
  );
}

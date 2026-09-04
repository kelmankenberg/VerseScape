import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  BookOpen,
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
  Tag,
  Trash2,
  Underline,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Extension, Node, nodeInputRule } from '@tiptap/core';
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
import { formatReference, fromVerseKey, getBook, parseReference, rangeToKeys, toVerseKey } from '@shared/reference/index.js';
import type { NoteAnchorRecord, NoteRecord, NotebookRecord, TagRecord } from '@shared/ipc/contracts.js';
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

const referenceInputPattern = /\[\[ref:((?:[1-3]?[A-Z]{3})\.\d+\.\d+)\]\]$/u;

const ReferenceNode = Node.create({
  name: 'reference',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: false,
  addAttributes() {
    return {
      reference: { default: null },
      label: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-versescape-reference]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, 'data-versescape-reference': HTMLAttributes.reference, class: 'notes-panel__reference' }, HTMLAttributes.label];
  },
  renderText({ node }) {
    return `[[ref:${String(node.attrs.reference)}]]`;
  },
  addInputRules() {
    return [
      nodeInputRule({
        find: referenceInputPattern,
        type: this.type,
        getAttributes: (match) => {
          const reference = match[1] ?? '';
          const parsed = parseNoteReference(reference);
          if (!parsed) return false;
          return { reference, label: parsed.label };
        },
      }),
    ];
  },
});

function parseNoteReference(value: string): { verseKey: number; label: string } | null {
  const match = /^((?:[1-3]?[A-Z]{3}))\.(\d+)\.(\d+)$/u.exec(value);
  if (!match) return null;
  const bookId = match[1];
  const chapter = Number(match[2]);
  const verse = Number(match[3]);
  if (!bookId || !chapter || !verse || !getBook(bookId as never)) return null;
  const reference = { book: bookId as never, chapter, verse };
  return { verseKey: toVerseKey(reference), label: formatReference({ start: reference, end: reference }) };
}

/**
 * Notes panel: displays and manages notes anchored to the current verse.
 * Joins the sync set so it follows synced verse navigation (FR-NT-06).
 */
export function NotesPanel({ tabId, state, setState }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const openOrNavigateBible = useWorkspace((store) => store.openOrNavigateBible);
  const lastBibleTabId = useWorkspace((store) => store.lastBibleTabId);
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
  const stateSelectionStartKey =
    typeof state === 'object' && state !== null && !Array.isArray(state) && typeof state['selectionStartKey'] === 'number'
      ? state['selectionStartKey']
      : null;
  const stateSelectionEndKey =
    typeof state === 'object' && state !== null && !Array.isArray(state) && typeof state['selectionEndKey'] === 'number'
      ? state['selectionEndKey']
      : null;
  const activeBibleTabState = useWorkspace((store) => {
    const tab = lastBibleTabId ? store.workspace.tabs[lastBibleTabId] : undefined;
    if (!tab || tab.panelType !== 'sample' || typeof tab.state !== 'object' || tab.state === null || Array.isArray(tab.state)) {
      return null;
    }
    return tab.state;
  });
  const activeBibleContext = activeBibleTabState
    ? {
        resourceId:
          typeof activeBibleTabState['resourceId'] === 'string'
            ? activeBibleTabState['resourceId']
            : 'bsb',
        startKey:
          typeof activeBibleTabState['selectionStartKey'] === 'number'
            ? activeBibleTabState['selectionStartKey']
            : null,
        endKey:
          typeof activeBibleTabState['selectionEndKey'] === 'number'
            ? activeBibleTabState['selectionEndKey']
            : null,
        verseKey:
          typeof activeBibleTabState['verseKey'] === 'number'
            ? activeBibleTabState['verseKey']
            : null,
      }
    : null;
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
  const [noteSearch, setNoteSearch] = useState('');
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [contextMenuNoteId, setContextMenuNoteId] = useState<string | null>(null);
  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null);
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [outlineMode, setOutlineMode] = useState(false);
  const [collapsedOutlineHeadings, setCollapsedOutlineHeadings] = useState<Set<string>>(new Set());
  const [noteTags, setNoteTags] = useState<TagRecord[]>([]);
  const [editorInputMode, setEditorInputMode] = useState<'link' | 'reference' | 'tag' | null>(null);
  const [editorInputValue, setEditorInputValue] = useState('');

  // Fetch notebooks on mount
  useEffect(() => {
    let cancelled = false;
    void window.versescape.annotations
      .listNotebooks()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setNotebooks(result.data);
          if (!selectedNotebookId && result.data.length > 0) {
            setSelectedNotebookId(result.data[0]?.id ?? null);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
          // Filter notes by selected notebook if one is selected
          let filteredNotes = result.data;
          if (selectedNotebookId) {
            filteredNotes = result.data.filter((note) => note.notebookId === selectedNotebookId);
          }
          setNotes(filteredNotes);
          setSelectedNoteId(
            requestedNoteId && filteredNotes.some((note) => note.id === requestedNoteId)
              ? requestedNoteId
              : filteredNotes[0]?.id ?? null,
          );
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentVerseKey, requestedNoteId, selectedNotebookId]);

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
    if (!selectedNoteId) {
      setNoteTags([]);
      return;
    }
    void window.versescape.annotations.listTagsForTarget({ targetKind: 'note', targetId: selectedNoteId })
      .then((result) => {
        if (result.ok) setNoteTags(result.data);
      });
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

  const createNotebook = (): void => {
    if (!newNotebookName.trim()) return;
    void window.versescape.annotations
      .createNotebook({ name: newNotebookName.trim(), parentId: null, kind: 'notebook' })
      .then((result) => {
        if (result.ok) {
          setNotebooks((prev) => [result.data, ...prev]);
          setSelectedNotebookId(result.data.id);
          setNewNotebookName('');
          setCreatingNotebook(false);
        }
      });
  };

  const createAnchoredNote = (): void => {
    const context = activeBibleContext ?? {
      resourceId: currentResourceId,
      startKey: stateSelectionStartKey,
      endKey: stateSelectionEndKey,
      verseKey: currentVerseKey,
    };
    const verseKey = context.verseKey ?? currentVerseKey;
    if (verseKey === null) return;
    void window.versescape.annotations
      .createNote({
        verseKey,
        title: 'New note',
        resourceId: context.resourceId,
        ...(context.startKey !== null && context.endKey !== null
          ? { startKey: context.startKey, endKey: context.endKey }
          : {}),
      })
      .then((result) => {
        if (result.ok) {
          setNotes((previous) => [result.data, ...previous]);
          setSelectedNoteId(result.data.id);
          setState({
            ...(typeof state === 'object' && state !== null && !Array.isArray(state) ? state : {}),
            noteId: result.data.id,
          });
        }
      });
  };

  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const normalizedNoteSearch = noteSearch.trim().toLowerCase();
  const visibleNotes = normalizedNoteSearch
    ? notes.filter(
        (note) =>
          note.title.toLowerCase().includes(normalizedNoteSearch) ||
          (note.bodyMd ?? '').toLowerCase().includes(normalizedNoteSearch),
      )
    : notes;

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

  const openNoteReference = (reference: string): void => {
    const parsed = parseNoteReference(reference);
    if (!parsed) return;
    openOrNavigateBible({ reference: parsed.label, verseKey: parsed.verseKey, resourceId: currentResourceId });
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      TextStyle,
      FontSize,
      ReferenceNode,
      Color,
      Highlight.configure({ multicolor: true }),
      LinkExtension.configure({ openOnClick: false, autolink: true }),
      SubscriptExtension,
      SuperscriptExtension,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: selectedNote?.bodyMd ?? '',
    immediatelyRender: false,
    editorProps: {
      handleClick: (_view, _position, event) => {
        const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-versescape-reference]') : null;
        const reference = target?.dataset['versescapeReference'];
        if (!reference) return false;
        event.preventDefault();
        openNoteReference(reference);
        return true;
      },
    },
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

  const beginEditorInput = (mode: 'link' | 'reference' | 'tag'): void => {
    setEditorInputMode(mode);
    setEditorInputValue('');
  };

  const submitEditorInput = (): void => {
    const value = editorInputValue.trim();
    const mode = editorInputMode;
    if (!value || !mode) return;

    if (mode === 'link') {
      editor?.chain().focus().setLink({ href: value }).run();
    } else if (mode === 'reference') {
      const reference = value.toUpperCase();
      const parsed = parseNoteReference(reference);
      if (!parsed) return;
      editor?.chain().focus().insertContent({ type: 'reference', attrs: { reference, label: parsed.label } }).run();
    } else if (selectedNoteId) {
      void window.versescape.annotations.createTag({ name: value, colour: null }).then((tagResult) => {
        if (!tagResult.ok) return;
        void window.versescape.annotations.addTagLink({ tagId: tagResult.data.id, targetKind: 'note', targetId: selectedNoteId })
          .then((linkResult) => {
            if (linkResult.ok) setNoteTags((previous) => previous.some((tag) => tag.id === tagResult.data.id) ? previous : [...previous, tagResult.data]);
          });
      });
    }

    setEditorInputMode(null);
    setEditorInputValue('');
  };

  const insertReference = (): void => {
    beginEditorInput('reference');
  };

  const addNoteTag = (): void => {
    beginEditorInput('tag');
  };

  const removeNoteTag = (tagId: string): void => {
    if (!selectedNoteId) return;
    void window.versescape.annotations.deleteTagLink({ tagId, targetKind: 'note', targetId: selectedNoteId })
      .then((result) => {
        if (result.ok) setNoteTags((previous) => previous.filter((tag) => tag.id !== tagId));
      });
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

  const removeNote = (requestedNoteId = selectedNoteId): void => {
    const noteId = requestedNoteId;
    if (!noteId) return;
    void window.versescape.annotations.deleteNote({ id: noteId }).then((result) => {
      if (!result.ok) return;
      setNotes((previous) => {
        const remaining = previous.filter((note) => note.id !== noteId);
        setSelectedNoteId(remaining[0]?.id ?? null);
        return remaining;
      });
      setMoreOpen(false);
      setContextMenuNoteId(null);
    });
  };
  const exportNote = (format: 'markdown' | 'html' | 'pdf'): void => {
    if (!selectedNoteId) return;
    void window.versescape.annotations
      .exportNote({ id: selectedNoteId, format })
      .then((result) => {
        if (result.ok) {
          const extension = format === 'markdown' ? 'md' : format;
          const type = format === 'markdown' ? 'text/markdown' : format === 'html' ? 'text/html' : 'application/pdf';
          const data = format === 'pdf'
            ? Uint8Array.from(atob(result.data), (character) => character.charCodeAt(0))
            : result.data;
          const filename = `${selectedNote?.title || 'note'}.${extension}`;
          const blob = new Blob([data], { type });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      });
  };

  const exportNotebook = (format: 'markdown' | 'html' | 'pdf'): void => {
    if (!selectedNotebookId) return;
    void window.versescape.annotations
      .exportNotebook({ id: selectedNotebookId, format })
      .then((result) => {
        if (!result.ok) return;
        const extension = format === 'markdown' ? 'md' : format;
        const type = format === 'markdown' ? 'text/markdown' : format === 'html' ? 'text/html' : 'application/pdf';
        const data = format === 'pdf'
          ? Uint8Array.from(atob(result.data), (character) => character.charCodeAt(0))
          : result.data;
        const notebook = notebooks.find((entry) => entry.id === selectedNotebookId);
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${notebook?.name || 'notebook'}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      });
  };

  const saveTitle = (): void => {
    const noteId = editingTitleId;
    const title = titleDraft.trim();
    if (!noteId || !title) {
      setEditingTitleId(null);
      return;
    }
    setNotes((previous) =>
      previous.map((note) => (note.id === noteId ? { ...note, title } : note)),
    );
    setEditingTitleId(null);
    void window.versescape.annotations.updateNote({ id: noteId, title });
  };

  const parseOutlineHeadings = (html: string): Array<{ level: number; text: string; key: string }> => {
    const document = new DOMParser().parseFromString(html, 'text/html');

    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((heading, index) => ({
      level: Number(heading.tagName.at(1) ?? '1'),
      text: heading.textContent ?? '',
      key: `heading-${index}`,
    }));
  };

  const outlineHeadings = selectedNote?.bodyMd ? parseOutlineHeadings(selectedNote.bodyMd) : [];

  const hasOutlineChildren = (index: number): boolean => {
    const heading = outlineHeadings[index];
    return heading !== undefined && (outlineHeadings[index + 1]?.level ?? 0) > heading.level;
  };

  const isOutlineHeadingVisible = (index: number): boolean => {
    const heading = outlineHeadings[index];
    if (heading === undefined) return false;

    let ancestorLevel = heading.level;

    for (let parentIndex = index - 1; parentIndex >= 0; parentIndex -= 1) {
      const parent = outlineHeadings[parentIndex];
      if (parent === undefined) continue;
      if (parent.level < ancestorLevel) {
        if (collapsedOutlineHeadings.has(parent.key)) return false;
        ancestorLevel = parent.level;
      }
    }

    return true;
  };

  return (
    <div className="notes-panel">
      <div className="notes-panel__toolbar">
        <span className="notes-panel__title">Notes</span>
        {notebooks.length > 0 && (
          <select
            className="notes-panel__notebook-select"
            value={selectedNotebookId ?? ''}
            onChange={(e) => setSelectedNotebookId(e.target.value || null)}
            aria-label="Filter by notebook"
          >
            <option value="">All notebooks</option>
            {notebooks.map((notebook) => (
              <option key={notebook.id} value={notebook.id}>
                {notebook.name}
              </option>
            ))}
          </select>
        )}
        {creatingNotebook && (
          <input
            className="notes-panel__notebook-input"
            type="text"
            autoFocus
            placeholder="Notebook name"
            value={newNotebookName}
            onChange={(e) => setNewNotebookName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                createNotebook();
              } else if (e.key === 'Escape') {
                setCreatingNotebook(false);
                setNewNotebookName('');
              }
            }}
            onBlur={() => {
              if (newNotebookName.trim()) {
                createNotebook();
              } else {
                setCreatingNotebook(false);
                setNewNotebookName('');
              }
            }}
          />
        )}
        <input
          className="notes-panel__search"
          type="search"
          aria-label="Search all notes"
          placeholder="Search all notes"
          value={noteSearch}
          onChange={(event) => setNoteSearch(event.target.value)}
        />
        {!creatingNotebook && (
          <button
            type="button"
            className="notes-panel__button"
            title="Create a new notebook"
            aria-label="Create notebook"
            onClick={() => setCreatingNotebook(true)}
          >
            <Plus size={14} />
          </button>
        )}
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
          {!loading && visibleNotes.length === 0 && (
            <div className="notes-panel__empty">
              {normalizedNoteSearch ? 'No matching notes.' : 'No notes yet.'}
            </div>
          )}
          {!loading &&
            visibleNotes.map((note) => (
              <div key={note.id} className="notes-panel__note">
                <div
                  role="button"
                  tabIndex={0}
                  className={`notes-panel__note-header${selectedNoteId === note.id ? ' notes-panel__note-header--selected' : ''}`}
                  onClick={(event) => {
                    if ((event.target as Element).closest('.notes-panel__note-title-input')) return;
                    setSelectedNoteId(note.id);
                    toggleExpand(note.id);
                    setState({
                      ...(typeof state === 'object' && state !== null && !Array.isArray(state) ? state : {}),
                      noteId: note.id,
                    });
                    if (editingTitleId === note.id) saveTitle();
                  }}
                  onDoubleClick={() => {
                    setEditingTitleId(note.id);
                    setTitleDraft(note.title);
                    setContextMenuNoteId(null);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setSelectedNoteId(note.id);
                    setContextMenuNoteId(note.id);
                  }}
                  onKeyDown={(event) => {
                    if ((event.target as Element).closest('.notes-panel__note-title-input')) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedNoteId(note.id);
                    }
                  }}
                >
                  <ChevronDown
                    size={14}
                    className={expandedNotes.has(note.id) ? 'notes-panel__chevron--open' : ''}
                  />
                  {editingTitleId === note.id ? (
                    <input
                      className="notes-panel__note-title-input"
                      aria-label={`Edit title ${note.title}`}
                      value={titleDraft}
                      autoFocus
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Enter') saveTitle();
                        if (event.key === 'Escape') setEditingTitleId(null);
                      }}
                      onBlur={saveTitle}
                    />
                  ) : (
                    <span className="notes-panel__note-title">{note.title}</span>
                  )}
                  <span className="notes-panel__note-date">Today</span>
                </div>
                {contextMenuNoteId === note.id && (
                  <div className="notes-panel__note-context-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => removeNote(note.id)}>
                      <Trash2 size={13} />
                      Delete note
                    </button>
                  </div>
                )}
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
                <button type="button" aria-label="Insert link" title="Insert link" onClick={() => beginEditorInput('link')}>
                  <Link size={15} />
                </button>
                <button type="button" aria-label="Insert Bible reference" title="Insert Bible reference" onClick={insertReference}>
                  <BookOpen size={15} />
                </button>
                <button type="button" aria-label="Add tag" title="Add tag" onClick={addNoteTag}>
                  <Tag size={15} />
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
                {editorInputMode && (
                  <form
                    className="notes-panel__editor-inline-input"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitEditorInput();
                    }}
                  >
                    <input
                      autoFocus
                      aria-label={editorInputMode === 'link' ? 'Link URL' : editorInputMode === 'reference' ? 'Bible reference' : 'Tag name'}
                      placeholder={editorInputMode === 'link' ? 'https://...' : editorInputMode === 'reference' ? 'JHN.3.16' : 'Tag name'}
                      value={editorInputValue}
                      onChange={(event) => setEditorInputValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setEditorInputMode(null);
                          setEditorInputValue('');
                        }
                      }}
                    />
                    <button type="submit" aria-label="Apply" disabled={!editorInputValue.trim()}><Plus size={14} /></button>
                  </form>
                )}
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
                      <button type="button" role="menuitem" onClick={() => removeNote()}>
                        <Trash2 size={14} />
                        Delete this note
                      </button>
                      <div className="notes-panel__menu-divider" />
                      <button type="button" role="menuitem" onClick={() => exportNote('markdown')}>
                        Export as Markdown
                      </button>
                      <button type="button" role="menuitem" onClick={() => exportNote('html')}>
                        Export as HTML
                      </button>
                      <button type="button" role="menuitem" onClick={() => exportNote('pdf')}>
                        Export as PDF
                      </button>
                      <div className="notes-panel__menu-divider" />
                      <button type="button" role="menuitem" onClick={() => exportNotebook('markdown')}>
                        Export notebook as Markdown
                      </button>
                      <button type="button" role="menuitem" onClick={() => exportNotebook('html')}>
                        Export notebook as HTML
                      </button>
                      <button type="button" role="menuitem" onClick={() => exportNotebook('pdf')}>
                        Export notebook as PDF
                      </button>
                      <div className="notes-panel__menu-divider" />
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={outlineMode}
                        onClick={() => setOutlineMode((mode) => !mode)}
                      >
                        <span className="notes-panel__menu-check">
                          {outlineMode ? '✓' : ''}
                        </span>
                        Outline mode
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {noteTags.length > 0 && (
                <div className="notes-panel__tags" aria-label="Note tags">
                  {noteTags.map((tag) => (
                    <span key={tag.id} className="notes-panel__tag" style={tag.colour ? { borderColor: tag.colour } : undefined}>
                      {tag.name}
                      <button type="button" aria-label={`Remove ${tag.name} tag`} onClick={() => removeNoteTag(tag.id)}>
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
                      const version = (anchor.resourceId ?? 'bsb').toUpperCase();
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
                            <span>{label}</span>
                            <span className="notes-panel__anchor-version">{version}</span>
                          </a>
                          <span
                            id={`anchor-tooltip-${anchorKey}`}
                            className="notes-panel__anchor-tooltip"
                            role="tooltip"
                          >
                            <span className="notes-panel__anchor-tooltip-reference">
                              {label} · {version}
                            </span>
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
              {outlineMode && outlineHeadings.length > 0 && (
                <div className="notes-panel__outline">
                  <div className="notes-panel__outline-heading">Outline</div>
                  <nav className="notes-panel__outline-list" role="navigation">
                    {outlineHeadings.map((heading, index) => {
                      if (!isOutlineHeadingVisible(index)) return null;

                      const hasChildren = hasOutlineChildren(index);
                      const isCollapsed = collapsedOutlineHeadings.has(heading.key);

                      return (
                        <div
                          key={heading.key}
                          className={`notes-panel__outline-row notes-panel__outline-row--h${heading.level}`}
                        >
                          {hasChildren && (
                            <button
                              type="button"
                              className={`notes-panel__outline-collapse${isCollapsed ? '' : ' notes-panel__outline-collapse--open'}`}
                              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${heading.text || `heading ${index + 1}`}`}
                              aria-expanded={!isCollapsed}
                              onClick={() => {
                                setCollapsedOutlineHeadings((collapsed) => {
                                  const next = new Set(collapsed);
                                  if (next.has(heading.key)) next.delete(heading.key);
                                  else next.add(heading.key);
                                  return next;
                                });
                              }}
                            >
                              <ChevronDown size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="notes-panel__outline-item"
                            onClick={() => {
                              const elements = editor?.view.dom.querySelectorAll('h1, h2, h3, h4, h5, h6');
                              if (elements?.[index]) {
                                (elements[index] as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }}
                          >
                            {heading.text || `Heading ${index + 1}`}
                          </button>
                        </div>
                      );
                    })}
                  </nav>
                </div>
              )}
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

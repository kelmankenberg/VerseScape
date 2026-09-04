import { BookOpen, ChevronDown, Download, FileText, Folder, FolderPlus, ListTree, MessageSquare, Printer, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatReference, fromVerseKey } from '@shared/reference/index.js';
import type { NoteRecord, NotebookRecord } from '@shared/ipc/contracts.js';
import { useWorkspace } from '../workspace/store.js';

function downloadText(filename: string, content: string, type: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/giu, (_, text: string) => `## ${text.replace(/<[^>]+>/gu, '')}\n\n`)
    .replace(/<strong>(.*?)<\/strong>/giu, '**$1**')
    .replace(/<em>(.*?)<\/em>/giu, '*$1*')
    .replace(/<li[^>]*>(.*?)<\/li>/giu, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/giu, '$1\n\n')
    .replace(/<br\s*\/?>(?<!\n)/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/&amp;/gu, '&')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

export function NotesPage(): React.JSX.Element {
  const openPanel = useWorkspace((store) => store.openPanel);
  const selectedPanelNoteId = useWorkspace((store) => {
    const noteTab = Object.values(store.workspace.tabs).find((tab) => tab.panelType === 'notes');
    if (!noteTab || typeof noteTab.state !== 'object' || noteTab.state === null || Array.isArray(noteTab.state)) {
      return null;
    }
    return typeof noteTab.state['noteId'] === 'string' ? noteTab.state['noteId'] : null;
  });
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState('default');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      window.versescape.annotations.listNotes({}),
      window.versescape.annotations.listNotebooks(),
    ]).then(([notesResult, notebooksResult]) => {
      if (cancelled) return;
      if (notesResult.ok) {
        setNotes(notesResult.data);
        setSelectedNoteId(
          selectedPanelNoteId && notesResult.data.some((note) => note.id === selectedPanelNoteId)
            ? selectedPanelNoteId
            : notesResult.data[0]?.id ?? null,
        );
      }
      if (notebooksResult.ok) {
        setNotebooks(notebooksResult.data);
        setSelectedNotebookId(notebooksResult.data[0]?.id ?? 'default');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedPanelNoteId]);

  const filteredNotes = useMemo(() => {
    const notebookNotes = notes.filter((note) => (note.notebookId ?? 'default') === selectedNotebookId);
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notebookNotes;
    return notebookNotes.filter(
      (note) =>
        note.title.toLowerCase().includes(normalized) ||
        (note.bodyMd ?? '').toLowerCase().includes(normalized),
    );
  }, [notes, query, selectedNotebookId]);
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const selectedReference = selectedNote
    ? fromVerseKey(selectedNote.verseKey)
    : null;
  const referenceLabel = selectedReference
    ? formatReference({ start: selectedReference, end: selectedReference })
    : null;

  const moveSelectedNote = (notebookId: string): void => {
    if (!selectedNote || notebookId === (selectedNote.notebookId ?? 'default')) return;
    void window.versescape.annotations
      .updateNote({ id: selectedNote.id, notebookId })
      .then((result) => {
        if (!result.ok) return;
        setNotes((previous) =>
          previous.map((note) =>
            note.id === selectedNote.id ? { ...note, notebookId } : note,
          ),
        );
        setNotebooks((previous) =>
          previous.map((notebook) => {
            const delta = notebook.id === notebookId ? 1 : notebook.id === (selectedNote.notebookId ?? 'default') ? -1 : 0;
            return delta === 0 ? notebook : { ...notebook, noteCount: notebook.noteCount + delta };
          }),
        );
      });
  };

  const exportSelected = (format: 'markdown' | 'html' | 'pdf'): void => {
    if (!selectedNote) return;
    const base = selectedNote.title.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'note';
    if (format === 'markdown') downloadText(`${base}.md`, `# ${selectedNote.title}\n\n${htmlToMarkdown(selectedNote.bodyMd ?? '')}`, 'text/markdown');
    else if (format === 'html') downloadText(`${base}.html`, `<!doctype html><title>${selectedNote.title}</title>${selectedNote.bodyMd ?? ''}`, 'text/html');
    else window.print();
  };

  const outline = selectedNote?.bodyMd
    ? [...selectedNote.bodyMd.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/giu)].map((match) => ({
        level: Number(match[1]),
        text: match[2]!.replace(/<[^>]+>/gu, ''),
      }))
    : [];

  const createNotebook = (kind: 'notebook' | 'commentary'): void => {
    const name = window.prompt(kind === 'commentary' ? 'Commentary notebook name' : 'Notebook name');
    if (!name?.trim()) return;
    void window.versescape.annotations
      .createNotebook({ name: name.trim(), parentId: null, kind })
      .then((result) => {
        if (result.ok) {
          setNotebooks((previous) => [...previous, result.data]);
          setSelectedNotebookId(result.data.id);
        }
      });
  };

  return (
    <div className="notes-page">
      <header className="notes-page__header">
        <div>
          <h1 className="notes-page__title">Notes</h1>
          <p className="notes-page__subtitle">Notebook</p>
        </div>
        <div className="notes-page__actions">
          <button
            type="button"
            className="notes-page__open-panel"
            aria-label="Create notebook"
            onClick={() => createNotebook('notebook')}
          >
            <FolderPlus size={14} />
            New notebook
          </button>
          <button type="button" className="notes-page__open-panel" disabled={!selectedNote} onClick={() => {
            if (!selectedNote) return;
            openPanel('notes', undefined, {
              noteId: selectedNote.id,
              verseKey: selectedNote.verseKey,
              ...(selectedNote.resourceId ? { resourceId: selectedNote.resourceId } : {}),
            });
          }}>
            <BookOpen size={14} />
            Open in workspace
          </button>
          <button type="button" className="notes-page__icon-action" aria-label="Toggle outline" title="Toggle outline" disabled={!selectedNote} onClick={() => setOutlineOpen((open) => !open)}>
            <ListTree size={15} />
          </button>
          <button type="button" className="notes-page__icon-action" aria-label="Export Markdown" title="Export Markdown" disabled={!selectedNote} onClick={() => exportSelected('markdown')}>
            <Download size={15} />
          </button>
          <button type="button" className="notes-page__icon-action" aria-label="Print or export PDF" title="Print or export PDF" disabled={!selectedNote} onClick={() => exportSelected('pdf')}>
            <Printer size={15} />
          </button>
        </div>
      </header>

      <div className="notes-page__body">
        <aside className="notes-page__notebooks" aria-label="Notebooks">
          <div className="notes-page__rail-heading">Notebooks</div>
          {notebooks.map((notebook) => (
            <button
              type="button"
              key={notebook.id}
              className={`notes-page__notebook${notebook.id === selectedNotebookId ? ' notes-page__notebook--active' : ''}`}
              onClick={() => setSelectedNotebookId(notebook.id)}
            >
              <Folder size={14} />
              <span>{notebook.name}</span>
              <span className="notes-page__count">{notebook.noteCount}</span>
            </button>
          ))}
          <button
            type="button"
            className="notes-page__new-notebook"
            aria-label="Create notebook"
            title="Create notebook"
            onClick={() => createNotebook('notebook')}
          >
            <FolderPlus size={14} />
            New notebook
          </button>
          <button
            type="button"
            className="notes-page__new-notebook"
            aria-label="Create commentary notebook"
            title="Create commentary notebook"
            onClick={() => createNotebook('commentary')}
          >
            <MessageSquare size={14} />
            New commentary
          </button>
        </aside>

        <section className="notes-page__list-section" aria-label="Notes list">
          <div className="notes-page__list-header">
            <strong>All notes</strong>
            <label className="notes-page__search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                aria-label="Search notes"
                placeholder="Search notes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>
          <div className="notes-page__list">
            {loading && <div className="notes-page__empty">Loading notes...</div>}
            {!loading && filteredNotes.length === 0 && (
              <div className="notes-page__empty">
                {query ? 'No matching notes.' : 'No notes yet.'}
              </div>
            )}
            {filteredNotes.map((note) => (
              <button
                type="button"
                key={note.id}
                className={`notes-page__note${note.id === selectedNoteId ? ' notes-page__note--active' : ''}`}
                onClick={() => setSelectedNoteId(note.id)}
              >
                <FileText size={14} />
                <span className="notes-page__note-info">
                  <strong>{note.title}</strong>
                  <span>{fromVerseKey(note.verseKey) ? formatReference({ start: fromVerseKey(note.verseKey)!, end: fromVerseKey(note.verseKey)! }) : 'Unlinked'}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <article className="notes-page__preview" aria-label="Selected note">
          {selectedNote ? (
            <>
              <div className="notes-page__preview-header">
                <h2>{selectedNote.title}</h2>
                <div className="notes-page__preview-meta">
                  {referenceLabel && <span>{referenceLabel}</span>}
                  <select
                    aria-label="Move note to notebook"
                    value={selectedNote.notebookId ?? 'default'}
                    onChange={(event) => moveSelectedNote(event.target.value)}
                  >
                    {notebooks.map((notebook) => (
                      <option key={notebook.id} value={notebook.id}>{notebook.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {outlineOpen && (
                <div className="notes-page__outline" aria-label="Note outline">
                  <div className="notes-page__outline-title"><ListTree size={14} /> Outline</div>
                  {outline.length === 0 ? <span>No headings in this note.</span> : outline.map((heading, index) => (
                    <button type="button" key={`${heading.text}-${index}`} style={{ paddingLeft: `${12 + heading.level * 10}px` }}>
                      <ChevronDown size={12} /> {heading.text}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="notes-page__preview-content"
                dangerouslySetInnerHTML={{ __html: selectedNote.bodyMd ?? '<p>Start writing your note...</p>' }}
              />
            </>
          ) : (
            <div className="notes-page__empty">Select a note to view it.</div>
          )}
        </article>
      </div>
    </div>
  );
}

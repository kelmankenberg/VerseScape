import { BookOpen, Download, FilePlus2, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { NotebookRecord } from '@shared/ipc/contracts.js';
import { useWorkspace } from '../workspace/store.js';

export function LibraryPage(): React.JSX.Element {
  const openPanel = useWorkspace((store) => store.openPanel);
  const [commentaries, setCommentaries] = useState<NotebookRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [description, setDescription] = useState('');
  const [deletingCommentaryId, setDeletingCommentaryId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void window.versescape.annotations.listNotebooks().then((result) => {
      if (result.ok) setCommentaries(result.data.filter((notebook) => notebook.kind === 'commentary'));
    });
  }, []);

  const createPersonalCommentary = (): void => {
    if (!title.trim() || !abbreviation.trim()) return;
    void window.versescape.annotations.createNotebook({
      name: title.trim(),
      parentId: null,
      kind: 'commentary',
      abbreviation: abbreviation.trim().toUpperCase(),
      description: description.trim() || null,
    }).then((result) => {
      if (!result.ok) return;
      setCommentaries((current) => [...current, result.data]);
      setCreating(false);
      setTitle('');
      setAbbreviation('');
      setDescription('');
    });
  };

  const downloadXml = (commentary: NotebookRecord): void => {
    void window.versescape.annotations.exportPersonalCommentaryXml({ id: commentary.id }).then((result) => {
      if (!result.ok) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([result.data], { type: 'application/xml' }));
      link.download = `${commentary.name.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '') || 'personal-commentary'}.xml`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  };

  const deleteCommentary = (commentaryId: string, action: 'recover' | 'delete'): void => {
    void window.versescape.annotations.deletePersonalCommentary({ id: commentaryId, action }).then((result) => {
      if (result.ok) setCommentaries((current) => current.filter((commentary) => commentary.id !== commentaryId));
      setDeletingCommentaryId(null);
    });
  };

  const exportThenDeleteCommentary = (commentary: NotebookRecord): void => {
    void window.versescape.annotations.exportPersonalCommentaryXml({ id: commentary.id }).then((result) => {
      if (!result.ok) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([result.data], { type: 'application/xml' }));
      link.download = `${commentary.name.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '') || 'personal-commentary'}.xml`;
      link.click();
      URL.revokeObjectURL(link.href);
      deleteCommentary(commentary.id, 'delete');
    });
  };

  const importXml = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void file.text().then((text) => {
      const document = new DOMParser().parseFromString(text, 'application/xml');
      const root = document.querySelector('versescape-personal-commentary');
      if (!root || document.querySelector('parsererror')) return;
      const name = root.getAttribute('title')?.trim();
      const abbreviation = root.getAttribute('abbreviation')?.trim();
      if (!name || !abbreviation) return;
      void window.versescape.annotations.createNotebook({
        name,
        parentId: null,
        kind: 'commentary',
        abbreviation,
        description: root.getAttribute('description') || null,
      }).then((commentaryResult) => {
        if (!commentaryResult.ok) return;
        const imported = commentaryResult.data;
        const entries = Array.from(root.querySelectorAll('entry'));
        void Promise.all(entries.map((entry) => {
          const anchorKind = entry.getAttribute('anchor-kind');
          return window.versescape.annotations.createCommentaryEntry({
            commentaryId: imported.id,
            title: entry.querySelector('title')?.textContent ?? 'Untitled entry',
            bodyMd: entry.querySelector('body')?.textContent ?? '',
            anchorKind: anchorKind === 'book' || anchorKind === 'chapter' ? anchorKind : 'verse_range',
            bookId: entry.getAttribute('book-id') ?? 'JHN',
            chapter: Number(entry.getAttribute('chapter')) || null,
            startKey: Number(entry.getAttribute('start-key')) || null,
            endKey: Number(entry.getAttribute('end-key')) || null,
            resourceId: entry.getAttribute('resource-id') || null,
          }).then((entryResult) => {
            if (!entryResult.ok) return;
            return Promise.all(Array.from(entry.querySelectorAll('tag')).map((tag) =>
              window.versescape.annotations.createTag({
                name: tag.textContent?.trim() ?? '',
                colour: tag.getAttribute('colour') || null,
              }).then((tagResult) => {
                if (!tagResult.ok) return;
                return window.versescape.annotations.addTagLink({ tagId: tagResult.data.id, targetKind: 'note', targetId: entryResult.data.noteId });
              }),
            ));
          });
        })).then(() => setCommentaries((current) => [...current, imported]));
      });
    });
  };

  return (
    <main className="library-page">
      <header className="library-page__header">
        <div><h1>Library</h1><p>Installed resources and your Personal Commentaries.</p></div>
        <div className="library-page__actions">
          <input ref={importInputRef} type="file" accept="application/xml,.xml" hidden onChange={importXml} />
          <button type="button" className="library-page__create" onClick={() => importInputRef.current?.click()}><Upload size={15} /> Import XML</button>
          <button type="button" className="library-page__create" onClick={() => setCreating(true)}><FilePlus2 size={15} /> Create Personal Commentary</button>
        </div>
      </header>
      {creating && (
        <form className="library-page__create-form" onSubmit={(event) => { event.preventDefault(); createPersonalCommentary(); }}>
          <input autoFocus aria-label="Personal Commentary title" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <input aria-label="Personal Commentary abbreviation" placeholder="Abbreviation" value={abbreviation} onChange={(event) => setAbbreviation(event.target.value)} />
          <input aria-label="Personal Commentary description" placeholder="Description (optional)" value={description} onChange={(event) => setDescription(event.target.value)} />
          <button type="button" onClick={() => setCreating(false)}>Cancel</button>
          <button type="submit" disabled={!title.trim() || !abbreviation.trim()}>Create</button>
        </form>
      )}
      <section className="library-page__section" aria-label="Personal Commentaries">
        <h2>Personal Commentaries</h2>
        {commentaries.length === 0 && <p className="library-page__empty">No Personal Commentaries yet. Create one when you want a dedicated Scripture-ordered work.</p>}
        <div className="library-page__resources">
          {commentaries.map((commentary) => (
            <article key={commentary.id} className="library-page__resource">
              <BookOpen size={20} aria-hidden />
              <div><h3>{commentary.name}</h3><p>{commentary.abbreviation ?? 'PC'} · {commentary.noteCount} entries{commentary.description ? ` · ${commentary.description}` : ''}</p></div>
              <div className="library-page__resource-actions">
                <button type="button" title="Export XML" aria-label={`Export ${commentary.name} as XML`} onClick={() => downloadXml(commentary)}><Download size={14} /></button>
                <button type="button" onClick={() => openPanel('commentary', undefined, { reference: 'John 3', verseKey: 43_003_001, commentaryId: commentary.id })}>Open</button>
                <button type="button" title="Delete Personal Commentary" aria-label={`Delete ${commentary.name}`} onClick={() => setDeletingCommentaryId(commentary.id)}><Trash2 size={14} /></button>
              </div>
              {deletingCommentaryId === commentary.id && (
                <div className="library-page__delete-choice">
                  <span>Keep entries as ordinary notes?</span>
                  <button type="button" onClick={() => deleteCommentary(commentary.id, 'recover')}>Recover notes</button>
                  <button type="button" onClick={() => exportThenDeleteCommentary(commentary)}>Export XML and delete</button>
                  <button type="button" onClick={() => setDeletingCommentaryId(null)}>Cancel</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

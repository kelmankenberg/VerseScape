import { BookOpen, FilePlus2, Pencil, Save, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatReference, fromVerseKey } from '@shared/reference/index.js';
import type { CommentaryAnchorKind, CommentaryEntryRecord, NotebookRecord } from '@shared/ipc/contracts.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import { useWorkspace } from '../workspace/store.js';
import type { PanelProps } from './registry.js';

export function CommentaryPanel({ tabId, state }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLElement | null>(null);
  const openOrNavigateBible = useWorkspace((store) => store.openOrNavigateBible);
  const syncSetId = useWorkspace((store) => store.workspace.tabs[tabId]?.syncSet ?? null);
  const syncVerseKey = useWorkspace((store) => syncSetId ? store.workspace.syncSets[syncSetId]?.verseKey ?? null : null);
  const stateVerseKey = typeof state === 'object' && state !== null && !Array.isArray(state) && typeof state['verseKey'] === 'number'
    ? state['verseKey'] : null;
  const requestedCommentaryId = typeof state === 'object' && state !== null && !Array.isArray(state) && typeof state['commentaryId'] === 'string'
    ? state['commentaryId'] : null;
  const verseKey = syncVerseKey ?? stateVerseKey;
  const reference = verseKey ? fromVerseKey(verseKey) : null;
  const [commentaries, setCommentaries] = useState<NotebookRecord[]>([]);
  const [commentaryId, setCommentaryId] = useState<string | null>(null);
  const [entries, setEntries] = useState<CommentaryEntryRecord[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [entryKind, setEntryKind] = useState<CommentaryAnchorKind>('verse_range');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  useVerseSync({ tabId, containerRef });

  useEffect(() => {
    void window.versescape.annotations.listNotebooks().then((result) => {
      if (!result.ok) return;
      const personalCommentaries = result.data.filter((notebook) => notebook.kind === 'commentary');
      setCommentaries(personalCommentaries);
      setCommentaryId((current) => {
        if (requestedCommentaryId && personalCommentaries.some((commentary) => commentary.id === requestedCommentaryId)) return requestedCommentaryId;
        return current && personalCommentaries.some((commentary) => commentary.id === current)
          ? current : personalCommentaries[0]?.id ?? null;
      });
    });
  }, [requestedCommentaryId]);

  useEffect(() => {
    if (!commentaryId || !reference) {
      setEntries([]);
      return;
    }
    void window.versescape.annotations.listCommentaryEntries({
      commentaryId,
      bookId: reference.book,
    }).then((result) => {
      if (result.ok) setEntries(result.data);
    });
  }, [commentaryId, reference?.book, reference?.chapter]);

  const entryLabel = (entry: CommentaryEntryRecord): string => {
    if (entry.anchorKind === 'book') return `${entry.bookId} introduction`;
    if (entry.anchorKind === 'chapter') return `${entry.bookId} ${entry.chapter} introduction`;
    const start = entry.startKey ? fromVerseKey(entry.startKey) : null;
    const end = entry.endKey ? fromVerseKey(entry.endKey) : null;
    return start && end ? formatReference({ start, end }) : entry.title;
  };

  const coversCurrentVerse = (entry: CommentaryEntryRecord): boolean =>
    entry.anchorKind === 'book' || entry.anchorKind === 'chapter' ||
    (verseKey !== null && entry.startKey !== null && entry.endKey !== null && entry.startKey <= verseKey && entry.endKey >= verseKey);

  const beginEntry = (kind: CommentaryAnchorKind): void => {
    setEntryKind(kind);
    setTitle(kind === 'book' ? `${reference?.book ?? ''} introduction` : kind === 'chapter' ? `${reference?.book ?? ''} ${reference?.chapter ?? ''} introduction` : '');
    setBody('');
    setSelectedEntryId(null);
    setEditOpen(true);
  };

  const saveEntry = (): void => {
    if (!commentaryId || !reference || !title.trim()) return;
    if (selectedEntryId) {
      void window.versescape.annotations.updateNote({ id: selectedEntryId, title: title.trim(), bodyMd: body }).then((result) => {
        if (result.ok) setEntries((current) => current.map((entry) => entry.noteId === selectedEntryId ? { ...entry, title: result.data.title, bodyMd: result.data.bodyMd ?? '' } : entry));
      });
    } else {
      void window.versescape.annotations.createCommentaryEntry({
        commentaryId,
        title: title.trim(),
        bodyMd: body,
        anchorKind: entryKind,
        bookId: reference.book,
        chapter: entryKind === 'chapter' ? reference.chapter : null,
        startKey: entryKind === 'verse_range' ? verseKey : null,
        endKey: entryKind === 'verse_range' ? verseKey : null,
        resourceId: null,
      }).then((result) => {
        if (result.ok) setEntries((current) => [...current, result.data]);
      });
    }
    setEditOpen(false);
  };

  return (
    <div className="personal-commentary-panel">
      <div className="personal-commentary-panel__toolbar">
        <span className="personal-commentary-panel__title">Personal Commentary</span>
        <select className="personal-commentary-panel__select" value={commentaryId ?? ''} onChange={(event) => setCommentaryId(event.target.value || null)} aria-label="Personal Commentary">
          <option value="">Select a Personal Commentary</option>
          {commentaries.map((commentary) => <option key={commentary.id} value={commentary.id}>{commentary.name}</option>)}
        </select>
        <button type="button" className="personal-commentary-panel__button" aria-label="Add verse entry" title="Add verse entry" disabled={!reference || !commentaryId} onClick={() => beginEntry('verse_range')}><FilePlus2 size={14} /></button>
        <button type="button" className="personal-commentary-panel__button" aria-label="Add chapter introduction" title="Add chapter introduction" disabled={!reference || !commentaryId} onClick={() => beginEntry('chapter')}><BookOpen size={14} /></button>
        <button type="button" className="personal-commentary-panel__button" aria-label="Add book introduction" title="Add book introduction" disabled={!reference || !commentaryId} onClick={() => beginEntry('book')}><BookOpen size={14} /></button>
      </div>
      {!commentaryId && <div className="personal-commentary-panel__empty">Create a Personal Commentary in Library to begin.</div>}
      {commentaryId && reference && <div className="personal-commentary-panel__context">{formatReference({ start: reference, end: reference })}</div>}
      {editOpen && (
        <form className="personal-commentary-panel__editor" onSubmit={(event) => { event.preventDefault(); saveEntry(); }}>
          <input aria-label="Entry title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Entry title" autoFocus />
          <textarea aria-label="Entry body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your commentary..." />
          <div><button type="button" onClick={() => setEditOpen(false)}><X size={14} /> Cancel</button><button type="submit" disabled={!title.trim()}><Save size={14} /> Save</button></div>
        </form>
      )}
      <section ref={containerRef} className="personal-commentary-panel__entries" aria-label="Personal Commentary entries">
        {commentaryId && !reference && <div className="personal-commentary-panel__empty">Choose a Scripture reference to read this commentary.</div>}
        {commentaryId && reference && entries.length === 0 && <div className="personal-commentary-panel__empty">No commentary entries for this chapter.</div>}
        {entries.map((entry) => (
          <article key={entry.noteId} data-verse={entry.startKey ?? undefined} className={`personal-commentary-panel__entry${coversCurrentVerse(entry) ? ' personal-commentary-panel__entry--active' : ''}`}>
            <header><span>{entryLabel(entry)}</span><button type="button" aria-label={`Edit ${entry.title}`} title="Edit entry" onClick={() => { setSelectedEntryId(entry.noteId); setTitle(entry.title); setBody(entry.bodyMd); setEditOpen(true); }}><Pencil size={13} /></button></header>
            <h2>{entry.title}</h2>
            <div dangerouslySetInnerHTML={{ __html: entry.bodyMd || '<p>No content yet.</p>' }} />
            {entry.startKey && <button type="button" className="personal-commentary-panel__open-bible" onClick={() => { const start = fromVerseKey(entry.startKey!); if (start) openOrNavigateBible({ reference: formatReference({ start, end: start }), verseKey: entry.startKey!, resourceId: entry.resourceId ?? 'bsb' }); }}>Open in Bible</button>}
            <button type="button" className="personal-commentary-panel__open-bible" onClick={() => {
              void window.versescape.annotations.deleteNote({ id: entry.noteId }).then((result) => {
                if (result.ok) setEntries((current) => current.filter((candidate) => candidate.noteId !== entry.noteId));
              });
            }}><Trash2 size={13} /> Delete entry</button>
          </article>
        ))}
      </section>
    </div>
  );
}

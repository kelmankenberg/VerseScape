import { Plus, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatReference, fromVerseKey } from '@shared/reference/index.js';
import type { NoteRecord, NotebookRecord } from '@shared/ipc/contracts.js';
import { useWorkspace } from '../workspace/store.js';
import { useVerseSync } from '../workspace/use-verse-sync.js';
import type { PanelProps } from './registry.js';

export function CommentaryPanel({ tabId, state }: PanelProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const syncSetId = useWorkspace((store) => store.workspace.tabs[tabId]?.syncSet ?? null);
  const syncVerse = useWorkspace((store) =>
    syncSetId ? store.workspace.syncSets[syncSetId]?.verseKey ?? null : null,
  );
  const stateVerse =
    typeof state === 'object' && state !== null && !Array.isArray(state) && typeof state['verseKey'] === 'number'
      ? state['verseKey']
      : null;
  const verseKey = syncVerse ?? stateVerse;
  const [entries, setEntries] = useState<NoteRecord[]>([]);
  const [commentaryNotebook, setCommentaryNotebook] = useState<NotebookRecord | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  useVerseSync({ tabId, containerRef });

  useEffect(() => {
    if (verseKey === null) return;
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      window.versescape.annotations.listNotes({ start: verseKey, end: verseKey }),
      window.versescape.annotations.listNotebooks(),
    ]).then(([notesResult, notebooksResult]) => {
      if (cancelled) return;
      if (notesResult.ok) {
        const commentaryEntries = notesResult.data.filter((entry) => entry.notebookKind === 'commentary');
        setEntries(commentaryEntries);
        setSelectedEntryId(commentaryEntries[0]?.id ?? null);
        setDraft(commentaryEntries[0]?.bodyMd ?? '');
      }
      if (notebooksResult.ok) setCommentaryNotebook(notebooksResult.data.find((notebook) => notebook.kind === 'commentary') ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [verseKey]);

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null;
  const createEntry = async (): Promise<void> => {
    if (verseKey === null) return;
    let notebook = commentaryNotebook;
    if (!notebook) {
      const notebookResult = await window.versescape.annotations.createNotebook({
        name: 'Personal Commentary',
        parentId: null,
        kind: 'commentary',
      });
      if (!notebookResult.ok) return;
      notebook = notebookResult.data;
      setCommentaryNotebook(notebook);
    }
    void window.versescape.annotations
      .createNote({
        verseKey,
        title: 'New commentary entry',
        notebookId: notebook.id,
      })
      .then((result) => {
        if (result.ok) {
          setEntries((previous) => [result.data, ...previous]);
          setSelectedEntryId(result.data.id);
          setDraft('');
        }
      });
  };

  const saveEntry = (): void => {
    if (!selectedEntry) return;
    void window.versescape.annotations
      .updateNote({ id: selectedEntry.id, bodyMd: draft })
      .then((result) => {
        if (result.ok) setEntries((previous) => previous.map((entry) => entry.id === result.data.id ? result.data : entry));
      });
  };

  const reference = verseKey ? fromVerseKey(verseKey) : null;
  const label = reference ? formatReference({ start: reference, end: reference }) : 'No verse selected';

  return (
    <div ref={containerRef} className="commentary-panel">
      <div className="commentary-panel__header">
        <strong>Personal Commentary</strong>
        <span>{label}</span>
        <button type="button" aria-label="New commentary entry" title="New commentary entry" disabled={verseKey === null} onClick={() => void createEntry()}>
          <Plus size={14} />
        </button>
      </div>
      {loading && <div className="commentary-panel__empty">Loading commentary...</div>}
      {!loading && entries.length === 0 && (
        <div className="commentary-panel__empty">No commentary entry for this verse.</div>
      )}
      {!loading && entries.map((entry) => (
        <article className={`commentary-panel__entry${entry.id === selectedEntryId ? ' commentary-panel__entry--selected' : ''}`} key={entry.id} onClick={() => { setSelectedEntryId(entry.id); setDraft(entry.bodyMd ?? ''); }}>
          <h2>{entry.title}</h2>
          {entry.id === selectedEntryId ? (
            <>
              <textarea aria-label={`Edit commentary ${entry.title}`} value={draft} onChange={(event) => setDraft(event.target.value)} />
              <button type="button" onClick={saveEntry}><Save size={13} /> Save entry</button>
            </>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: entry.bodyMd ?? '<p>No entry text yet.</p>' }} />
          )}
        </article>
      ))}
    </div>
  );
}

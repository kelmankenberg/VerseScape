import { BookOpen, Database, LibraryBig, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LibraryResource } from '@shared/ipc/contracts.js';
import { useSettings } from '../stores/settings.js';
import { useWorkspace } from '../workspace/store.js';

const categoryLabels: Record<LibraryResource['type'], string> = {
  bible: 'Bibles',
  commentary: 'Commentaries',
  lexicon: 'Lexicons',
  glossary: 'Glossaries',
  'study-data': 'Study data',
};

function ResourceIcon({ type }: { type: LibraryResource['type'] }): React.JSX.Element {
  if (type === 'bible') return <BookOpen size={14} aria-hidden />;
  if (type === 'commentary') return <LibraryBig size={14} aria-hidden />;
  return <Database size={14} aria-hidden />;
}

export function LibrarySidebar(): React.JSX.Element {
  const openPanel = useWorkspace((store) => store.openPanel);
  const setActivePage = useSettings((store) => store.setActivePage);
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void window.versescape.resources.listLibrary().then((result) => {
      if (result.ok) setResources(result.data);
    });
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleResources = resources.filter((resource) =>
    resource.title.toLowerCase().includes(normalizedQuery) ||
    resource.abbreviation.toLowerCase().includes(normalizedQuery),
  );

  const openResource = (resource: LibraryResource): void => {
    if (!resource.enabled || (resource.type !== 'bible' && resource.type !== 'commentary')) return;
    openPanel(
      resource.type === 'bible' ? 'sample' : 'commentary',
      undefined,
      resource.type === 'bible'
        ? { reference: 'John 3', verseKey: 43_003_001, resourceId: resource.id }
        : {
            reference: 'John 3',
            verseKey: 43_003_001,
            commentaryResourceId: resource.id,
            commentaryAbbreviation: resource.abbreviation,
          },
    );
    void setActivePage('workspace');
  };

  return (
    <div className="library-sidebar">
      <label className="library-sidebar__search">
        <Search size={14} aria-hidden />
        <input
          type="search"
          aria-label="Filter installed resources"
          placeholder="Filter resources"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {(['bible', 'commentary', 'lexicon', 'glossary', 'study-data'] as const).map((type) => {
        const grouped = visibleResources.filter((resource) => resource.type === type);
        if (grouped.length === 0) return null;
        return (
          <section className="library-sidebar__group" key={type} aria-label={categoryLabels[type]}>
            <h3>{categoryLabels[type]}</h3>
            {grouped.map((resource) => {
              const openable = resource.type === 'bible' || resource.type === 'commentary';
              return (
                <button
                  type="button"
                  className={`library-sidebar__resource${resource.enabled ? '' : ' library-sidebar__resource--disabled'}`}
                  key={resource.id}
                  disabled={!openable || !resource.enabled}
                  title={openable ? `Open ${resource.title}` : `${resource.title} is used by study tools`}
                  onClick={() => openResource(resource)}
                >
                  <ResourceIcon type={resource.type} />
                  <span>{resource.abbreviation}</span>
                  {!resource.enabled && <small>Off</small>}
                </button>
              );
            })}
          </section>
        );
      })}
      {visibleResources.length === 0 && <p className="library-sidebar__empty">No installed resources match.</p>}
    </div>
  );
}

import { BookOpen, Columns2, NotebookPen, Search, SquareDashed } from 'lucide-react';
import { registerPanel } from './registry.js';
import { PlaceholderPanel } from './PlaceholderPanel.js';
import { ScratchPanel } from './ScratchPanel.js';
import { SamplePanel } from './SamplePanel.js';
import { PassageComparePanel } from './PassageComparePanel.js';
import { StrongsPanel, type StrongsPanelState } from './StrongsPanel.js';
import { SearchResultsPanel } from './SearchResultsPanel.js';

/**
 * M2 test panels. Real Bible, Notes and commentary panels replace these in M3
 * and M5; the shell only ever sees the descriptor.
 */
export function registerBuiltInPanels(): void {
  registerPanel({
    type: 'placeholder',
    title: 'Empty',
    icon: SquareDashed,
    linkable: false,
    hasReferenceInput: false,
    createState: () => null,
    component: PlaceholderPanel,
  });

  registerPanel({
    type: 'scratch',
    title: 'Scratch',
    icon: NotebookPen,
    linkable: false,
    hasReferenceInput: false,
    createState: () => ({ text: '' }),
    component: ScratchPanel,
  });

  registerPanel({
    type: 'sample',
    title: 'Bible',
    icon: BookOpen,
    linkable: true,
    hasReferenceInput: true,
    createState: () => ({ reference: 'John 3', verseKey: 43_003_001, resourceId: 'bsb' }),
    component: SamplePanel,
  });

  registerPanel({
    type: 'passage-compare',
    title: 'Passage Compare',
    icon: Columns2,
    linkable: true,
    hasReferenceInput: true,
    createState: () => ({ reference: 'John 3', verseKey: 43_003_001 }),
    component: PassageComparePanel,
  });

  registerPanel({
    type: 'strongs',
    title: "Strong's Concordance",
    icon: Search,
    linkable: false,
    hasReferenceInput: false,
    createState: (): StrongsPanelState => ({ strongNumber: '' }),
    component: StrongsPanel,
  });

  registerPanel({
    type: 'search-results',
    title: 'Search Results',
    icon: Search,
    linkable: false,
    hasReferenceInput: false,
    createState: () => ({ query: '', resourceIds: [], testament: '', startBook: '', endBook: '' }),
    component: SearchResultsPanel,
  });
}

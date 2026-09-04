import type { PageId } from '@shared/settings.js';
import { LibrarySidebar } from './LibrarySidebar.js';

export interface SidebarProvider {
  title: string;
  render: () => React.JSX.Element;
}

function Placeholder({ lines }: { lines: string[] }): React.JSX.Element {
  return (
    <ul className="sidebar__placeholder">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

/**
 * Sidebar content is looked up by page, so a section owns its own panel
 * without the shell knowing anything about it (FR-SH-12).
 * These are M1 placeholders; real providers arrive with their milestones.
 */
export const sidebarProviders: Partial<Record<PageId, SidebarProvider>> = {
  workspace: {
    title: 'Study navigation',
    render: () => <Placeholder lines={['Book and chapter navigation is available inside each Bible panel.']} />,
  },
  notes: {
    title: 'Notebooks',
    render: () => <Placeholder lines={['Notebook navigation is available on the Notes page.']} />,
  },
  library: {
    title: 'Resources',
    render: () => <LibrarySidebar />,
  },
  plans: {
    title: 'Reading Plans',
    render: () => <Placeholder lines={['Plan list — M7', "Today's reading — M7"]} />,
  },
};

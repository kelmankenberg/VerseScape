import type { PageId } from '@shared/settings.js';

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
    title: 'Books',
    render: () => <Placeholder lines={['Bible panel Contents — available in each Bible panel']} />,
  },
  notes: {
    title: 'Notebooks',
    render: () => <Placeholder lines={['Notebook tree — M5', 'Quick filter — M5']} />,
  },
  library: {
    title: 'Resources',
    render: () => <Placeholder lines={['Installed resources — M6', 'Downloads — M6']} />,
  },
  plans: {
    title: 'Reading Plans',
    render: () => <Placeholder lines={['Plan list — M7', "Today's reading — M7"]} />,
  },
};

import { useSettings } from '../stores/settings.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { WorkspacePage } from '../pages/WorkspacePage.js';
import { LibraryPage } from '../pages/LibraryPage.js';
import { NotesPage } from '../pages/NotesPage.js';
import { PlansPage } from '../pages/PlansPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { AccountPage } from '../pages/AccountPage.js';
import type { PageId } from '@shared/settings.js';

const pages: Record<PageId, () => React.JSX.Element> = {
  dashboard: DashboardPage,
  workspace: WorkspacePage,
  library: LibraryPage,
  notes: NotesPage,
  plans: PlansPage,
  settings: SettingsPage,
  account: AccountPage,
};

/** Exactly one page occupies the page area at a time (FR-SH-07). */
export function PageRouter(): React.JSX.Element {
  const activePage = useSettings((state) => state.settings.shell.activePage);
  const Page = pages[activePage];

  return (
    <main className="page" role="main" data-page={activePage}>
      <Page />
    </main>
  );
}

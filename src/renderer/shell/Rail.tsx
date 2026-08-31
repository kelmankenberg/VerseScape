import { useSettings } from '../stores/settings.js';
import { primaryNav, utilityNav } from './navigation.js';
import type { NavItem } from './navigation.js';
import type { PageId } from '@shared/settings.js';

function RailButton({
  item,
  expanded,
  active,
  onSelect,
}: {
  item: NavItem;
  expanded: boolean;
  active: boolean;
  onSelect: (id: PageId) => void;
}): React.JSX.Element {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`rail__item${active ? ' rail__item--active' : ''}`}
      aria-current={active ? 'page' : undefined}
      title={expanded ? undefined : item.label}
      onClick={() => onSelect(item.id)}
    >
      <span className="rail__icon">
        <Icon size={18} aria-hidden />
      </span>
      {expanded && <span className="rail__label">{item.label}</span>}
    </button>
  );
}

export function Rail(): React.JSX.Element {
  const expanded = useSettings((state) => state.settings.shell.railExpanded);
  const activePage = useSettings((state) => state.settings.shell.activePage);
  const sidebarOpen = useSettings((state) => state.settings.shell.sidebarOpen);
  const setActivePage = useSettings((state) => state.setActivePage);
  const setSidebarOpen = useSettings((state) => state.setSidebarOpen);

  // Re-selecting the active section toggles its sidebar, as in VS Code.
  const select = (id: PageId): void => {
    const item = [...primaryNav, ...utilityNav].find((entry) => entry.id === id);
    if (id === activePage && item?.hasSidebar) {
      void setSidebarOpen(!sidebarOpen);
      return;
    }
    void setActivePage(id);
    void setSidebarOpen(item?.hasSidebar ?? false);
  };

  return (
    <nav
      className={`rail${expanded ? ' rail--expanded' : ''}`}
      aria-label="Primary"
      data-testid="rail"
    >
      <div className="rail__group">
        {primaryNav.map((item) => (
          <RailButton
            key={item.id}
            item={item}
            expanded={expanded}
            active={item.id === activePage}
            onSelect={select}
          />
        ))}
      </div>

      <div className="rail__group rail__group--bottom">
        {utilityNav.map((item) => (
          <RailButton
            key={item.id}
            item={item}
            expanded={expanded}
            active={item.id === activePage}
            onSelect={select}
          />
        ))}
      </div>
    </nav>
  );
}

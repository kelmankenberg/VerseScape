import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Library,
  NotebookPen,
  Settings,
  UserRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PageId } from '@shared/settings.js';

export interface NavItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
  /** Whether selecting this item can expand the contextual sidebar (FR-SH-12). */
  hasSidebar: boolean;
}

export const primaryNav: readonly NavItem[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard, hasSidebar: false },
  { id: 'workspace', label: 'Study', icon: BookOpen, hasSidebar: true },
  { id: 'notes', label: 'Notes', icon: NotebookPen, hasSidebar: true },
  { id: 'library', label: 'Library', icon: Library, hasSidebar: true },
  { id: 'plans', label: 'Plans', icon: CalendarDays, hasSidebar: true },
];

export const utilityNav: readonly NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings, hasSidebar: false },
  { id: 'account', label: 'Account', icon: UserRound, hasSidebar: false },
];

const allNav = [...primaryNav, ...utilityNav];

export function navItemFor(page: PageId): NavItem {
  return allNav.find((item) => item.id === page) ?? allNav[0]!;
}

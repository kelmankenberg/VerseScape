import type { LucideIcon } from 'lucide-react';
import type { JsonValue, TabId } from '@shared/workspace/index.js';

export interface PanelProps {
  tabId: TabId;
  state: JsonValue;
  setState: (state: JsonValue) => void;
  /** Whether this tab is the active tab in its group. Absent (`undefined`) in
   * contexts that don't track that, such as unit tests. */
  visible?: boolean;
}

export interface PanelDescriptor {
  type: string;
  title: string;
  icon: LucideIcon;
  /** Participates in verse sync sets (FR-WS-08). */
  linkable: boolean;
  /** Whether the panel shows the reference input in its header. */
  hasReferenceInput: boolean;
  createState: () => JsonValue;
  component: React.ComponentType<PanelProps>;
}

const registry = new Map<string, PanelDescriptor>();

export function registerPanel(descriptor: PanelDescriptor): void {
  registry.set(descriptor.type, descriptor);
}

export function getPanel(type: string): PanelDescriptor | null {
  return registry.get(type) ?? null;
}

export function listPanels(): PanelDescriptor[] {
  return [...registry.values()];
}

/** Panels a user can create from the New Panel menu; `placeholder` is not one. */
export function creatablePanels(): PanelDescriptor[] {
  return listPanels().filter((panel) => panel.type !== 'placeholder');
}

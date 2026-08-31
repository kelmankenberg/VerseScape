import { useCallback, useEffect, useRef, useState } from 'react';
import { PanelLeftClose } from 'lucide-react';
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '@shared/settings.js';
import { useSettings } from '../stores/settings.js';
import { sidebarProviders } from './sidebar-providers.js';

const clamp = (value: number): number =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));

export function Sidebar(): React.JSX.Element | null {
  const activePage = useSettings((state) => state.settings.shell.activePage);
  const open = useSettings((state) => state.settings.shell.sidebarOpen);
  const storedWidth = useSettings((state) => state.settings.shell.sidebarWidth);
  const setSidebarOpen = useSettings((state) => state.setSidebarOpen);
  const setSidebarWidth = useSettings((state) => state.setSidebarWidth);

  // Track width locally while dragging; only persist once on release.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const provider = sidebarProviders[activePage];
  const width = dragWidth ?? storedWidth;

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragWidth(elementRef.current?.getBoundingClientRect().width ?? SIDEBAR_MIN_WIDTH);
  }, []);

  useEffect(() => {
    if (dragWidth === null) return;

    const onMove = (event: PointerEvent): void => {
      const left = elementRef.current?.getBoundingClientRect().left ?? 0;
      setDragWidth(clamp(event.clientX - left));
    };
    const onUp = (): void => {
      setDragWidth((final) => {
        if (final !== null) void setSidebarWidth(final);
        return null;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragWidth, setSidebarWidth]);

  if (!open || !provider) return null;

  return (
    <aside
      ref={elementRef}
      className="sidebar"
      style={{ width }}
      aria-label={provider.title}
      data-testid="sidebar"
    >
      <div className="sidebar__header">
        <h2 className="sidebar__title">{provider.title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Collapse sidebar"
          onClick={() => void setSidebarOpen(false)}
        >
          <PanelLeftClose size={15} aria-hidden />
        </button>
      </div>

      <div className="sidebar__body">{provider.render()}</div>

      <div
        className="sidebar__resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') void setSidebarWidth(clamp(storedWidth - 16));
          if (event.key === 'ArrowRight') void setSidebarWidth(clamp(storedWidth + 16));
        }}
      />
    </aside>
  );
}

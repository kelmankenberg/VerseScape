import type { ReactNode } from 'react';

/**
 * Shared shape for the M1 page stubs so each milestone can replace one page
 * without touching the shell.
 */
export function PagePlaceholder({
  title,
  description,
  milestone,
  children,
}: {
  title: string;
  description: string;
  milestone: string;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="page-placeholder">
      <header className="page-placeholder__header">
        <h1 className="page-placeholder__title">{title}</h1>
        <p className="page-placeholder__description">{description}</p>
      </header>
      {children}
      <p className="page-placeholder__milestone">Arrives in {milestone}</p>
    </div>
  );
}

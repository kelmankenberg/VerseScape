import { BookOpen, CalendarCheck, NotebookPen, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Widget {
  id: string;
  title: string;
  icon: LucideIcon;
  body: string;
  milestone: string;
}

const widgets: Widget[] = [
  {
    id: 'continue',
    title: 'Continue Reading',
    icon: BookOpen,
    body: 'Pick up where you left off.',
    milestone: 'M3',
  },
  {
    id: 'plan',
    title: "Today's Reading",
    icon: CalendarCheck,
    body: 'Your active reading plan for today.',
    milestone: 'M7',
  },
  {
    id: 'notes',
    title: 'Recent Notes',
    icon: NotebookPen,
    body: 'The notes you touched most recently.',
    milestone: 'M5',
  },
  {
    id: 'votd',
    title: 'Verse of the Day',
    icon: Sparkles,
    body: 'A passage to sit with today.',
    milestone: 'M7',
  },
];

export function DashboardPage(): React.JSX.Element {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <h1 className="dashboard__title">Welcome to VerseScape</h1>
        <p className="dashboard__subtitle">
          An offline-first study workspace. Open the Study section to begin.
        </p>
      </header>

      <div className="dashboard__grid">
        {widgets.map((widget) => {
          const Icon = widget.icon;
          return (
            <section key={widget.id} className="widget">
              <header className="widget__header">
                <Icon size={16} aria-hidden />
                <h2 className="widget__title">{widget.title}</h2>
              </header>
              <p className="widget__body">{widget.body}</p>
              <span className="widget__milestone">{widget.milestone}</span>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export type Page = "timer" | "timesheet" | "customers" | "settings";

interface NavigationProps {
  page: Page;
  onChange: (page: Page) => void;
  running: boolean;
}

export function Navigation({ page, onChange, running }: NavigationProps) {
  const items: Array<{ id: Page; label: string }> = [
    { id: "timer", label: "Timer" },
    { id: "timesheet", label: "Timesheet" },
    { id: "customers", label: "Customers" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">T</div>
        <div>
          <strong>Time Tracker</strong>
          <small>{running ? "Timer running" : "Ready"}</small>
        </div>
      </div>
      <nav>
        {items.map((item) => (
          <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => onChange(item.id)}>
            {item.label}
            {item.id === "timer" && running && <span className="running-dot" />}
          </button>
        ))}
      </nav>
    </aside>
  );
}

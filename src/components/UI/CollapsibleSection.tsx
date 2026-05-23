import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  id: string;
  title: string;
  actions?: React.ReactNode;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

const STORAGE_KEY = "pix.rail.collapsed.v1";

function loadCollapsedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveCollapsedSet(s: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
}

export default function CollapsibleSection({
  id,
  title,
  actions,
  defaultCollapsed = false,
  children,
}: Props) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const s = loadCollapsedSet();
    if (s.has(id)) return true;
    if (s.has(`!${id}`)) return false;
    return defaultCollapsed;
  });

  useEffect(() => {
    const s = loadCollapsedSet();
    if (collapsed) {
      s.add(id);
      s.delete(`!${id}`);
    } else {
      s.delete(id);
      s.add(`!${id}`);
    }
    saveCollapsedSet(s);
  }, [collapsed, id]);

  return (
    <div className={`panel ${collapsed ? "is-collapsed" : ""}`}>
      <div className="panel-head section-head">
        <button
          className="section-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls={`sect-${id}`}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span className="panel-title">{title}</span>
        </button>
        {actions && <div className="section-actions">{actions}</div>}
      </div>
      {!collapsed && (
        <div id={`sect-${id}`} className="section-body">
          {children}
        </div>
      )}
    </div>
  );
}

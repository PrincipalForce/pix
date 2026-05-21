import React from "react";
import { Undo2, Redo2 } from "lucide-react";
import { EditorAPI } from "@/hooks/useEditor";

interface Props {
  api: EditorAPI;
}

export default function HistoryPanel({ api }: Props) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">History</span>
      </div>
      <div className="history-controls">
        <button
          className="hbtn"
          onClick={api.undo}
          disabled={api.historyIndex <= 0}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} /> Undo
        </button>
        <button
          className="hbtn"
          onClick={api.redo}
          disabled={api.historyIndex >= api.history.length - 1}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={14} /> Redo
        </button>
      </div>
      <div className="history-list">
        {api.history.map((entry, i) => (
          <button
            key={entry.id}
            className={`hist-item ${i === api.historyIndex ? "is-current" : ""} ${
              i > api.historyIndex ? "is-future" : ""
            }`}
            onClick={() => api.jumpHistory(i)}
            title={new Date(entry.timestamp).toLocaleTimeString()}
          >
            <span className="hist-bullet" />
            <span className="hist-label">{entry.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

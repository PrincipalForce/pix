import React, { useEffect, useState } from "react";
import { Play, Square, Circle, Trash2, Upload, Download, FileText } from "lucide-react";
import { EditorAPI } from "@/hooks/useEditor";
import {
  deleteAction,
  exportActionsBundle,
  importActionsBundle,
  loadActions,
  upsertAction,
} from "@/lib/actions/storage";
import { playAction } from "@/lib/actions/player";
import { parseAtn } from "@/lib/actions/atn";
import { PixAction } from "@/lib/actions/types";

interface Props {
  api: EditorAPI;
}

export default function ActionsPanel({ api }: Props) {
  const [actions, setActions] = useState<PixAction[]>(() => loadActions());
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => setActions(loadActions());

  // Refresh action list whenever we stop recording (so a freshly saved action shows up).
  useEffect(() => {
    if (!api.isRecording) refresh();
  }, [api.isRecording]);

  const onToggleRecord = () => {
    if (!api.isRecording) {
      api.startRecording();
      return;
    }
    const steps = api.stopRecording();
    if (steps.length === 0) {
      alert("No recordable steps were captured.");
      return;
    }
    const name = prompt("Save action as:", `Action ${actions.length + 1}`);
    if (!name) return;
    const action: PixAction = {
      id: `act-${Date.now()}`,
      name,
      source: "user",
      createdAt: Date.now(),
      steps,
    };
    upsertAction(action);
    refresh();
  };

  const play = async (a: PixAction) => {
    setBusy(a.id);
    try {
      const { ran, skipped } = await playAction(api, a);
      if (skipped > 0) {
        console.info(`Action "${a.name}" finished. Ran ${ran} step(s), skipped ${skipped}.`);
      }
    } finally {
      setBusy(null);
    }
  };

  const onImport = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "atn") {
      try {
        const buf = await file.arrayBuffer();
        const imported = parseAtn(buf);
        for (const a of imported) upsertAction(a);
        refresh();
        alert(`Imported ${imported.length} action(s). Note: only steps that map to built-in filters will execute.`);
      } catch (e) {
        alert("Failed to import .atn: " + (e as Error).message);
      }
    } else if (ext === "json") {
      try {
        const txt = await file.text();
        const n = importActionsBundle(txt);
        refresh();
        alert(`Imported ${n} action(s).`);
      } catch (e) {
        alert("Failed to import action bundle: " + (e as Error).message);
      }
    } else {
      alert("Unsupported file. Use .atn or .json.");
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Actions</span>
      </div>
      <div className="actions-controls">
        <button
          className={`hbtn ${api.isRecording ? "is-recording" : ""}`}
          onClick={onToggleRecord}
          title={api.isRecording ? "Stop recording" : "Record"}
        >
          {api.isRecording ? <Square size={12} /> : <Circle size={12} />}
          {api.isRecording ? "Stop" : "Record"}
        </button>
        <label className="hbtn">
          <Upload size={12} /> Import
          <input
            type="file"
            accept=".atn,.json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              (e.target as HTMLInputElement).value = "";
            }}
          />
        </label>
        <button
          className="hbtn"
          onClick={() => {
            const blob = new Blob([exportActionsBundle()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "pix-actions.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
          title="Export all actions as JSON"
        >
          <Download size={12} /> Export
        </button>
      </div>

      <div className="actions-list">
        {actions.length === 0 && (
          <div className="empty">
            <FileText size={22} strokeWidth={1.4} />
            <div>No saved actions. Click Record to capture your next moves.</div>
          </div>
        )}
        {actions.map((a) => (
          <div key={a.id} className="action-row">
            <div className="action-meta">
              <div className="action-name">{a.name}</div>
              <div className="action-sub">
                {a.steps.length} step{a.steps.length === 1 ? "" : "s"} · {a.source}
              </div>
            </div>
            <button
              className="lay-act"
              onClick={() => play(a)}
              disabled={busy !== null}
              title="Play action"
            >
              <Play size={13} />
            </button>
            <button
              className="lay-act danger"
              onClick={() => {
                if (!confirm(`Delete "${a.name}"?`)) return;
                deleteAction(a.id);
                refresh();
              }}
              title="Delete action"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

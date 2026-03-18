import React from "react";
import { HistoryEntry } from "@/types/editor";

interface HistoryPanelProps {
  history: HistoryEntry[];
  onUndo: () => void;
  onRedo: () => void;
}

export default function HistoryPanel({
  history,
  onUndo,
  onRedo
}: HistoryPanelProps) {
  const currentIndex = history.findIndex(entry => !entry.applied);
  const canUndo = currentIndex > 0 || (currentIndex === -1 && history.length > 0);
  const canRedo = currentIndex !== -1;

  return (
    <div className="panel">
      <div className="panel-header">
        <span>History</span>
      </div>
      <div className="panel-content">
        {/* Undo/Redo Controls */}
        <div className="flex space-x-2 mb-4">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ↶ Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex-1 btn-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ↷ Redo
          </button>
        </div>

        {/* History List */}
        <div className="space-y-1 max-h-60 overflow-y-auto">
          {history.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <p className="text-sm">No history yet</p>
              <p className="text-xs mt-1">Start editing to see your actions here</p>
            </div>
          ) : (
            history.map((entry, index) => {
              const isActive = index < (currentIndex === -1 ? history.length : currentIndex);
              
              return (
                <div
                  key={entry.id}
                  className={`p-2 rounded text-sm ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  } transition-colors`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{entry.action}</span>
                    <span className="text-xs opacity-75 ml-2">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* History Info */}
        {history.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <div className="text-xs text-gray-400">
              <p>Total actions: {history.length}</p>
              <p>
                Current position: {currentIndex === -1 ? history.length : currentIndex} / {history.length}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
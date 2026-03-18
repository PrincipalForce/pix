import React from "react";
import { Tool } from "@/types/editor";

interface ToolPanelProps {
  selectedTool: Tool;
  onToolSelect: (tool: Tool) => void;
}

const tools: { id: Tool; icon: string; name: string }[] = [
  { id: 'select', icon: '↖', name: 'Select' },
  { id: 'move', icon: '✋', name: 'Move' },
  { id: 'brush', icon: '🖌', name: 'Brush' },
  { id: 'eraser', icon: '🧽', name: 'Eraser' },
  { id: 'text', icon: 'T', name: 'Text' },
  { id: 'shape', icon: '⬜', name: 'Shape' },
  { id: 'crop', icon: '✂', name: 'Crop' },
  { id: 'eyedropper', icon: '💧', name: 'Eyedropper' },
  { id: 'zoom', icon: '🔍', name: 'Zoom' },
  { id: 'hand', icon: '✋', name: 'Hand' }
];

export default function ToolPanel({ selectedTool, onToolSelect }: ToolPanelProps) {
  return (
    <div className="flex flex-col p-2 space-y-1">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => onToolSelect(tool.id)}
          className={`tool-button ${selectedTool === tool.id ? 'active' : ''}`}
          title={tool.name}
        >
          <span className="text-lg">{tool.icon}</span>
        </button>
      ))}
    </div>
  );
}
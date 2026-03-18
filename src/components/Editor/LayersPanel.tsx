import React from "react";
import { Layer } from "@/types/editor";

interface LayersPanelProps {
  layers: Layer[];
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  onLayerDelete: (layerId: string) => void;
  onLayerSelect: (layerId: string) => void;
}

export default function LayersPanel({
  layers,
  onLayerUpdate,
  onLayerDelete,
  onLayerSelect
}: LayersPanelProps) {
  const blendModes = [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'soft-light',
    'hard-light',
    'color-dodge',
    'color-burn',
    'darken',
    'lighten',
    'difference',
    'exclusion'
  ];

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Layers</span>
      </div>
      <div className="panel-content">
        <div className="space-y-3">
          {[...layers].reverse().map((layer, index) => (
            <div
              key={layer.id}
              className="bg-gray-700 rounded p-3 border border-gray-600 hover:border-gray-500 transition-colors"
              onClick={() => onLayerSelect(layer.id)}
            >
              {/* Layer Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLayerUpdate(layer.id, { visible: !layer.visible });
                    }}
                    className="text-sm"
                  >
                    {layer.visible ? '👁' : '🚫'}
                  </button>
                  <span className="text-sm font-medium truncate">{layer.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerDelete(layer.id);
                  }}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  ×
                </button>
              </div>

              {/* Layer Controls */}
              <div className="space-y-2">
                {/* Opacity */}
                <div>
                  <label className="text-xs text-gray-300">Opacity</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={layer.opacity}
                    onChange={(e) =>
                      onLayerUpdate(layer.id, { opacity: parseFloat(e.target.value) })
                    }
                    className="form-range"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="text-xs text-gray-400">
                    {Math.round(layer.opacity * 100)}%
                  </span>
                </div>

                {/* Blend Mode */}
                <div>
                  <label className="text-xs text-gray-300">Blend Mode</label>
                  <select
                    value={layer.blendMode}
                    onChange={(e) =>
                      onLayerUpdate(layer.id, { blendMode: e.target.value })
                    }
                    className="form-select"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {blendModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1).replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Position (for non-background layers) */}
                {layer.type !== 'background' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-300">X</label>
                      <input
                        type="number"
                        value={layer.x}
                        onChange={(e) =>
                          onLayerUpdate(layer.id, { x: parseInt(e.target.value) || 0 })
                        }
                        className="form-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-300">Y</label>
                      <input
                        type="number"
                        value={layer.y}
                        onChange={(e) =>
                          onLayerUpdate(layer.id, { y: parseInt(e.target.value) || 0 })
                        }
                        className="form-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {layers.length === 0 && (
            <div className="text-center text-gray-400 py-8">
              <p className="text-sm">No layers yet</p>
              <p className="text-xs mt-1">Upload an image or start drawing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
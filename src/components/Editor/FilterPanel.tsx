import React, { useState } from "react";
import { Layer } from "@/types/editor";
import { applyFilter, applyAIFilter } from "@/utils/filters";
import { generateAIFilter } from "@/utils/aiFilters";

interface FilterPanelProps {
  layers: Layer[];
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  onHistoryAdd: (action: string) => void;
}

export default function FilterPanel({
  layers,
  onLayerUpdate,
  onHistoryAdd
}: FilterPanelProps) {
  const [selectedLayer, setSelectedLayer] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const basicFilters = [
    { id: 'blur', name: 'Blur', icon: '🌫' },
    { id: 'sharpen', name: 'Sharpen', icon: '🔍' },
    { id: 'brightness', name: 'Brightness', icon: '☀' },
    { id: 'contrast', name: 'Contrast', icon: '🌓' },
    { id: 'saturation', name: 'Saturation', icon: '🌈' },
    { id: 'grayscale', name: 'Grayscale', icon: '⚪' },
    { id: 'sepia', name: 'Sepia', icon: '🟤' },
    { id: 'invert', name: 'Invert', icon: '🔄' },
    { id: 'vintage', name: 'Vintage', icon: '📷' },
    { id: 'cold', name: 'Cold', icon: '❄' },
    { id: 'warm', name: 'Warm', icon: '🔥' },
    { id: 'dramatic', name: 'Dramatic', icon: '⚡' }
  ];

  const aiFilters = [
    { id: 'style-transfer', name: 'Style Transfer', icon: '🎨' },
    { id: 'enhance', name: 'AI Enhance', icon: '✨' },
    { id: 'colorize', name: 'Colorize', icon: '🌈' },
    { id: 'restore', name: 'Restore', icon: '🔧' },
    { id: 'upscale', name: 'Upscale', icon: '📈' },
    { id: 'remove-noise', name: 'Denoise', icon: '🔇' }
  ];

  const imageOnlyLayers = layers.filter(layer => layer.type === 'image');
  const currentLayer = layers.find(layer => layer.id === selectedLayer);

  const handleBasicFilter = async (filterId: string) => {
    if (!selectedLayer || !currentLayer) {
      alert('Please select a layer first');
      return;
    }

    if (currentLayer.type !== 'image' || !(currentLayer.data instanceof HTMLImageElement)) {
      alert('Please select an image layer');
      return;
    }

    try {
      const filteredImage = await applyFilter(currentLayer.data, filterId);
      onLayerUpdate(selectedLayer, { data: filteredImage });
      onHistoryAdd(`Applied ${basicFilters.find(f => f.id === filterId)?.name} filter`);
    } catch (error) {
      console.error('Error applying filter:', error);
      alert('Failed to apply filter');
    }
  };

  const handleAIFilter = async (filterId: string) => {
    if (!selectedLayer || !currentLayer) {
      alert('Please select a layer first');
      return;
    }

    if (currentLayer.type !== 'image' || !(currentLayer.data instanceof HTMLImageElement)) {
      alert('Please select an image layer');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const filteredImage = await applyAIFilter(currentLayer.data, filterId);
      onLayerUpdate(selectedLayer, { data: filteredImage });
      onHistoryAdd(`Applied ${aiFilters.find(f => f.id === filterId)?.name} AI filter`);
    } catch (error) {
      console.error('Error applying AI filter:', error);
      alert('Failed to apply AI filter. Please check your API keys.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCustomAIFilter = async () => {
    if (!selectedLayer || !currentLayer || !aiPrompt.trim()) {
      alert('Please select a layer and enter a prompt');
      return;
    }

    if (currentLayer.type !== 'image' || !(currentLayer.data instanceof HTMLImageElement)) {
      alert('Please select an image layer');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const filteredImage = await generateAIFilter(currentLayer.data, aiPrompt);
      onLayerUpdate(selectedLayer, { data: filteredImage });
      onHistoryAdd(`Applied custom AI filter: "${aiPrompt}"`);
      setAiPrompt('');
    } catch (error) {
      console.error('Error applying custom AI filter:', error);
      alert('Failed to apply custom AI filter. Please check your API keys.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span>Filters</span>
      </div>
      <div className="panel-content">
        {/* Layer Selection */}
        <div className="mb-4">
          <label className="text-sm text-gray-300 mb-2 block">Select Layer</label>
          <select
            value={selectedLayer}
            onChange={(e) => setSelectedLayer(e.target.value)}
            className="form-select"
          >
            <option value="">Choose a layer...</option>
            {imageOnlyLayers.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </div>

        {/* Basic Filters */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Basic Filters</h3>
          <div className="grid grid-cols-3 gap-2">
            {basicFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => handleBasicFilter(filter.id)}
                disabled={!selectedLayer}
                className="flex flex-col items-center p-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs transition-colors"
              >
                <span className="text-lg mb-1">{filter.icon}</span>
                <span>{filter.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Filters */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">AI Filters</h3>
          <div className="grid grid-cols-2 gap-2">
            {aiFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => handleAIFilter(filter.id)}
                disabled={!selectedLayer || isGeneratingAI}
                className="flex flex-col items-center p-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs transition-all"
              >
                <span className="text-lg mb-1">{filter.icon}</span>
                <span>{filter.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom AI Filter */}
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Custom AI Filter</h3>
          <div className="space-y-2">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describe the effect you want... e.g., 'make it look like a watercolor painting'"
              className="form-input h-20 resize-none"
              disabled={isGeneratingAI}
            />
            <button
              onClick={handleCustomAIFilter}
              disabled={!selectedLayer || !aiPrompt.trim() || isGeneratingAI}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingAI ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : (
                'Apply Custom Filter'
              )}
            </button>
          </div>
        </div>

        {imageOnlyLayers.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <p className="text-sm">No image layers available</p>
            <p className="text-xs mt-1">Upload an image to apply filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
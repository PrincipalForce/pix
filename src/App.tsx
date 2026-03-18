import React, { useState, useCallback, useRef } from "react";
import Canvas from "./components/Editor/Canvas";
import ToolPanel from "./components/Editor/ToolPanel";
import LayersPanel from "./components/Editor/LayersPanel";
import FilterPanel from "./components/Editor/FilterPanel";
import HistoryPanel from "./components/Editor/HistoryPanel";
import ImageUpload from "./components/UI/ImageUpload";
import CameraCapture from "./components/UI/CameraCapture";
import ExportDialog from "./components/UI/ExportDialog";
import ShareDialog from "./components/UI/ShareDialog";
import { EditorState, Tool, Layer, HistoryEntry } from "./types/editor";
import { useImageEditor } from "./hooks/useImageEditor";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    editorState,
    selectedTool,
    layers,
    history,
    addLayer,
    updateLayer,
    deleteLayer,
    selectLayer,
    addHistoryEntry,
    undo,
    redo,
    setSelectedTool
  } = useImageEditor();

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState(false);

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        addLayer({
          id: `layer-${Date.now()}`,
          name: `Image Layer ${layers.length + 1}`,
          type: 'image',
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          x: 0,
          y: 0,
          width: img.width,
          height: img.height,
          data: img
        });
        addHistoryEntry('Add Image Layer');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [addLayer, addHistoryEntry, layers.length]);

  const handleCameraCapture = useCallback((imageSrc: string) => {
    const img = new Image();
    img.onload = () => {
      addLayer({
        id: `layer-${Date.now()}`,
        name: `Camera Capture ${layers.length + 1}`,
        type: 'image',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
        data: img
      });
      addHistoryEntry('Camera Capture');
    };
    img.src = imageSrc;
    setShowCameraCapture(false);
  }, [addLayer, addHistoryEntry, layers.length]);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">Photoshop Clone</h1>
          <div className="flex space-x-2">
            <ImageUpload onImageUpload={handleImageUpload} />
            <button
              onClick={() => setShowCameraCapture(true)}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Camera
            </button>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowExportDialog(true)}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Export
          </button>
          <button
            onClick={() => setShowShareDialog(true)}
            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Share
          </button>
        </div>
      </header>

      {/* Main Editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Tools */}
        <div className="w-16 bg-gray-800 border-r border-gray-700">
          <ToolPanel
            selectedTool={selectedTool}
            onToolSelect={setSelectedTool}
          />
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-gray-600 p-4">
            <Canvas
              ref={canvasRef}
              layers={layers}
              selectedTool={selectedTool}
              onLayerUpdate={updateLayer}
              onHistoryAdd={addHistoryEntry}
            />
          </div>
        </div>

        {/* Right Panels */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <LayersPanel
              layers={layers}
              onLayerUpdate={updateLayer}
              onLayerDelete={deleteLayer}
              onLayerSelect={selectLayer}
            />
            <FilterPanel
              layers={layers}
              onLayerUpdate={updateLayer}
              onHistoryAdd={addHistoryEntry}
            />
            <HistoryPanel
              history={history}
              onUndo={undo}
              onRedo={redo}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {showExportDialog && (
        <ExportDialog
          canvas={canvasRef.current}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {showShareDialog && (
        <ShareDialog
          canvas={canvasRef.current}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {showCameraCapture && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCameraCapture(false)}
        />
      )}
    </div>
  );
}
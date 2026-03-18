import React, { useEffect, useRef, forwardRef, useCallback } from "react";
import { Layer, Tool } from "@/types/editor";

interface CanvasProps {
  layers: Layer[];
  selectedTool: Tool;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  onHistoryAdd: (action: string) => void;
}

const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>((
  { layers, selectedTool, onLayerUpdate, onHistoryAdd },
  ref
) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const currentPath = useRef<{ x: number; y: number }[]>([]);

  // Forward ref
  useEffect(() => {
    if (ref && typeof ref === 'object') {
      ref.current = canvasRef.current;
    }
  }, [ref]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw checkerboard background
    const size = 20;
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#e5e7eb';
    for (let x = 0; x < canvas.width; x += size) {
      for (let y = 0; y < canvas.height; y += size) {
        if ((x / size + y / size) % 2 === 0) {
          ctx.fillRect(x, y, size, size);
        }
      }
    }

    // Draw layers
    layers
      .filter(layer => layer.visible)
      .forEach(layer => {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;

        if (layer.type === 'image' && layer.data instanceof HTMLImageElement) {
          ctx.drawImage(
            layer.data,
            layer.x,
            layer.y,
            layer.width,
            layer.height
          );
        } else if (layer.type === 'drawing' && layer.data instanceof ImageData) {
          ctx.putImageData(layer.data, layer.x, layer.y);
        } else if (layer.type === 'text' && typeof layer.data === 'string') {
          ctx.fillStyle = layer.color || '#000000';
          ctx.font = `${layer.fontSize || 16}px ${layer.fontFamily || 'Arial'}`;
          ctx.fillText(layer.data, layer.x, layer.y);
        }

        ctx.restore();
      });
  }, [layers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 800;
    canvas.height = 600;
    redrawCanvas();
  }, [redrawCanvas]);

  const getCanvasPoint = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const point = getCanvasPoint(e);
    isDrawing.current = true;
    lastPoint.current = point;
    currentPath.current = [point];

    if (selectedTool === 'brush' || selectedTool === 'eraser') {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.lineWidth = selectedTool === 'brush' ? 5 : 10;
      ctx.lineCap = 'round';
      ctx.strokeStyle = selectedTool === 'brush' ? '#000000' : '#ffffff';
      ctx.globalCompositeOperation = selectedTool === 'brush' ? 'source-over' : 'destination-out';
      
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing.current) return;

    const point = getCanvasPoint(e);
    currentPath.current.push(point);

    if (selectedTool === 'brush' || selectedTool === 'eraser') {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }

    lastPoint.current = point;
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) return;

    isDrawing.current = false;
    lastPoint.current = null;

    if (selectedTool === 'brush' || selectedTool === 'eraser') {
      // Create a new drawing layer with the current path
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Find or create a drawing layer
      const drawingLayer = layers.find(layer => layer.type === 'drawing' && layer.name === 'Drawing Layer');
      
      if (drawingLayer) {
        onLayerUpdate(drawingLayer.id, { data: imageData });
      } else {
        // This would need to be handled by the parent component
        // as we don't have access to addLayer here
      }
      
      onHistoryAdd(`${selectedTool === 'brush' ? 'Brush' : 'Eraser'} Stroke`);
    }

    currentPath.current = [];
  };

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        className="canvas-border cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
});

Canvas.displayName = 'Canvas';

export default Canvas;
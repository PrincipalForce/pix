import { useRef, useCallback, useEffect } from "react";
import { Layer } from "@/types/editor";

export interface CanvasHook {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  redrawCanvas: () => void;
  getCanvasPoint: (e: React.MouseEvent | MouseEvent) => { x: number; y: number };
  clearCanvas: () => void;
  resizeCanvas: (width: number, height: number) => void;
}

export function useCanvas(layers: Layer[]): CanvasHook {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
        
        // Set blend mode
        try {
          ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
        } catch (error) {
          ctx.globalCompositeOperation = 'source-over';
        }

        // Draw based on layer type
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
        } else if (layer.type === 'shape') {
          ctx.fillStyle = layer.color || '#000000';
          ctx.strokeStyle = layer.strokeColor || '#000000';
          ctx.lineWidth = layer.strokeWidth || 1;
          
          // Draw different shapes based on layer.shapeType
          const shapeType = layer.shapeType || 'rectangle';
          
          switch (shapeType) {
            case 'rectangle':
              if (layer.fill !== false) {
                ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
              }
              if (layer.stroke !== false) {
                ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
              }
              break;
            case 'circle':
              ctx.beginPath();
              const radius = Math.min(layer.width, layer.height) / 2;
              ctx.arc(
                layer.x + layer.width / 2,
                layer.y + layer.height / 2,
                radius,
                0,
                2 * Math.PI
              );
              if (layer.fill !== false) ctx.fill();
              if (layer.stroke !== false) ctx.stroke();
              break;
          }
        }

        ctx.restore();
      });
  }, [layers]);

  const getCanvasPoint = useCallback((e: React.MouseEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const resizeCanvas = useCallback((width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;
    redrawCanvas();
  }, [redrawCanvas]);

  // Redraw when layers change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  return {
    canvasRef,
    redrawCanvas,
    getCanvasPoint,
    clearCanvas,
    resizeCanvas
  };
}
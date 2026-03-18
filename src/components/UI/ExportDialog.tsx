import React, { useState } from "react";
import { saveAs } from "file-saver";

interface ExportDialogProps {
  canvas: HTMLCanvasElement | null;
  onClose: () => void;
}

export default function ExportDialog({ canvas, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [quality, setQuality] = useState(0.9);
  const [filename, setFilename] = useState('edited-image');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!canvas) {
      alert('No canvas to export');
      return;
    }

    setIsExporting(true);
    
    try {
      // Create a new canvas with white background for JPEG
      let exportCanvas = canvas;
      
      if (format === 'jpeg') {
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        
        const ctx = exportCanvas.getContext('2d');
        if (ctx) {
          // Fill with white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
          
          // Draw the original canvas
          ctx.drawImage(canvas, 0, 0);
        }
      }

      // Convert to blob
      const mimeType = `image/${format}`;
      
      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            const finalFilename = `${filename}.${format}`;
            saveAs(blob, finalFilename);
            onClose();
          } else {
            alert('Failed to export image');
          }
          setIsExporting(false);
        },
        mimeType,
        format === 'jpeg' || format === 'webp' ? quality : undefined
      );
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export image');
      setIsExporting(false);
    }
  };

  const getFileSize = () => {
    if (!canvas) return 'Unknown';
    
    // Rough estimation based on canvas size and format
    const pixels = canvas.width * canvas.height;
    let estimatedSize;
    
    switch (format) {
      case 'png':
        estimatedSize = pixels * 4; // 4 bytes per pixel for RGBA
        break;
      case 'jpeg':
        estimatedSize = pixels * quality * 0.5; // Rough JPEG compression estimate
        break;
      case 'webp':
        estimatedSize = pixels * quality * 0.3; // WebP is more efficient
        break;
      default:
        estimatedSize = pixels * 4;
    }
    
    // Convert to human-readable format
    if (estimatedSize < 1024) return `${Math.round(estimatedSize)} B`;
    if (estimatedSize < 1024 * 1024) return `${Math.round(estimatedSize / 1024)} KB`;
    return `${(estimatedSize / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Export Image</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Filename */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="form-input"
              placeholder="Enter filename"
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm text-gray-300 mb-2">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'png' | 'jpeg' | 'webp')}
              className="form-select"
            >
              <option value="png">PNG (lossless, transparency)</option>
              <option value="jpeg">JPEG (smaller file, no transparency)</option>
              <option value="webp">WebP (modern, efficient)</option>
            </select>
          </div>

          {/* Quality (for JPEG and WebP) */}
          {(format === 'jpeg' || format === 'webp') && (
            <div>
              <label className="block text-sm text-gray-300 mb-2">
                Quality: {Math.round(quality * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="form-range"
              />
            </div>
          )}

          {/* Preview Info */}
          {canvas && (
            <div className="bg-gray-700 p-3 rounded">
              <div className="text-sm text-gray-300 space-y-1">
                <div>Dimensions: {canvas.width} × {canvas.height} px</div>
                <div>Estimated size: {getFileSize()}</div>
                <div>Final filename: {filename}.{format}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!canvas || !filename.trim() || isExporting}
            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <span className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Exporting...
              </span>
            ) : (
              'Export'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
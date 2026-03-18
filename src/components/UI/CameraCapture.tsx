import React, { useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { useCamera } from "@/hooks/useCamera";

interface CameraCaptureProps {
  onCapture: (imageSrc: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const { hasPermission, isLoading, error, requestPermission } = useCamera();

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  }, [onCapture]);

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            <span>Requesting camera permission...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !hasPermission) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg text-center max-w-md">
          <h3 className="text-lg font-semibold mb-4">Camera Access Required</h3>
          <p className="text-gray-300 mb-6">
            {error || "Please allow camera access to capture photos."}
          </p>
          <div className="flex space-x-3">
            <button
              onClick={requestPermission}
              className="flex-1 btn-primary"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg max-w-4xl w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Camera Capture</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="relative">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            className="w-full rounded-lg"
          />
          
          {/* Camera overlay */}
          <div className="absolute inset-0 border-2 border-dashed border-white opacity-30 rounded-lg pointer-events-none" />
          
          {/* Capture button */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <button
              onClick={capturePhoto}
              className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-100 transition-colors flex items-center justify-center"
            >
              <div className="w-12 h-12 bg-red-500 rounded-full" />
            </button>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <div className="text-sm text-gray-400">
            Click the capture button to take a photo
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
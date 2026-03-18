import { useState, useEffect, useCallback } from "react";

export interface CameraHook {
  hasPermission: boolean | null;
  isLoading: boolean;
  error: string | null;
  stream: MediaStream | null;
  requestPermission: () => Promise<void>;
  stopCamera: () => void;
}

export function useCamera(): CameraHook {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const requestPermission = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported in this browser');
      }

      // Request camera permission
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      setStream(mediaStream);
      setHasPermission(true);
    } catch (err) {
      console.error('Camera permission error:', err);
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera and try again.');
        } else if (err.name === 'NotReadableError') {
          setError('Camera is already in use by another application.');
        } else {
          setError(err.message || 'Failed to access camera');
        }
      } else {
        setError('An unknown error occurred while accessing the camera');
      }
      
      setHasPermission(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Check initial permission state
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions) {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          
          if (permission.state === 'granted') {
            await requestPermission();
          } else if (permission.state === 'denied') {
            setHasPermission(false);
            setError('Camera permission denied');
          }
          
          // Listen for permission changes
          permission.addEventListener('change', () => {
            if (permission.state === 'denied') {
              setHasPermission(false);
              stopCamera();
            }
          });
        }
      } catch (error) {
        // Permissions API not supported, we'll request when needed
        console.log('Permissions API not supported');
      }
    };

    checkPermission();
  }, [requestPermission, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    hasPermission,
    isLoading,
    error,
    stream,
    requestPermission,
    stopCamera
  };
}
import React, { useRef, useCallback, useState } from 'react';
import Webcam from 'react-webcam';
import { Button } from "@/components/ui/button"; // Assuming shadcn/ui Button
import { toast } from "sonner";

interface ImageCaptureProps {
  onImageCaptured: (imageFile: File) => void;
  onCancel: () => void;
}

export function ImageCapture({ onImageCaptured, onCancel }: ImageCaptureProps) {
  const webcamRef = useRef<Webcam>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoConstraints = {
    width: 480,
    height: 640,
    facingMode: facingMode,
  };

  const capture = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        try {
          const blob = await fetch(imageSrc).then(res => res.blob());
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onImageCaptured(file);
        } catch (e) {
          console.error("Error converting screenshot to file:", e);
          toast.error("Could not process image. Please try again.");
          setError("Could not process image.");
        }
      } else {
        toast.error("Could not capture image. Webcam might not be ready.");
        setError("Could not capture image.");
      }
    } else {
      toast.error("Webcam not available.");
      setError("Webcam not available.");
    }
  }, [webcamRef, onImageCaptured]);

  const toggleFacingMode = () => {
    setFacingMode(prevMode => (prevMode === 'user' ? 'environment' : 'user'));
  };

  const handleUserMedia = () => {
    setCameraReady(true);
    setError(null); // Clear previous errors once camera is ready
  };

  const handleUserMediaError = (err: any) => {
    console.error("Webcam Access Error:", err);
    let errorMessage = "Could not access camera.";
    if (typeof err === 'string') {
      errorMessage = err;
    } else if (err.name) {
      switch(err.name) {
        case "NotAllowedError":
        case "PermissionDeniedError":
          errorMessage = "Camera permission denied. Please allow camera access in your browser settings.";
          break;
        case "NotFoundError":
        case "DevicesNotFoundError":
          errorMessage = "No camera found. Please ensure a camera is connected and enabled.";
          break;
        case "NotReadableError":
        case "TrackStartError":
          errorMessage = "Camera is already in use or cannot be started.";
          break;
        default:
          errorMessage = `Could not access camera: ${err.name}`;
      }
    }
    setError(errorMessage);
    toast.error(errorMessage);
    setCameraReady(false);
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 rounded-lg shadow-md w-full max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Live Image Capture</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 w-full" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="relative w-full aspect-[3/4] bg-black rounded overflow-hidden mb-4">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          className="absolute top-0 left-0 w-full h-full object-cover"
          mirrored={facingMode === 'user'}
        />
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <p className="text-white text-lg">Initializing Camera...</p>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-3 w-full">
        <Button
          onClick={capture}
          disabled={!cameraReady || !!error}
          className="flex-grow bg-blue-500 hover:bg-blue-600 text-white"
        >
          Capture Photo
        </Button>
        <Button
          onClick={toggleFacingMode}
          disabled={!cameraReady || !!error}
          variant="outline"
          className="flex-grow"
        >
          Switch Camera
        </Button>
        <Button
          onClick={onCancel}
          variant="destructive"
          className="flex-grow bg-red-500 hover:bg-red-600 text-white"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

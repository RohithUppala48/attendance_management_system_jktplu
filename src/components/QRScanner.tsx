import React, { useEffect, useState, useCallback, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ImageCapture } from "./ImageCapture";

export function QRScanner() {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [showImageCapture, setShowImageCapture] = useState(false);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const qrReaderRef = useRef<HTMLDivElement>(null);
  const [isScannerInitialized, setIsScannerInitialized] = useState(false);

  const user = useQuery(api.auth.loggedInUser);
  const validateResult = useQuery(api.sessions.validateQRCode,
    qrData ? { 
      encryptedData: qrData, 
      studentLocation: currentLocation || undefined 
    } : "skip"
  );
  const markAttendance = useMutation(api.sessions.markAttendance);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  // Initialize QR Scanner
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;

    const initializeScanner = () => {
      if (!scanning || showImageCapture || isScannerInitialized) {
        return;
      }

      try {
        // Clean up any existing scanner
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
          scannerRef.current = null;
        }

        // Initialize new scanner
        scanner = new Html5QrcodeScanner(
          "qr-reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          false
        );

        scannerRef.current = scanner;

        scanner.render(
          (decodedText) => {
            setQrData(decodedText);
            setScanning(false);
            setShowImageCapture(true);
          },
          (errorMessage) => {
            console.warn("QR Scan Error:", errorMessage);
            if (scanning && !showImageCapture) {
              setError(`QR Scanning Error. Please try again.`);
            }
          }
        );

        setIsScannerInitialized(true);
      } catch (err) {
        console.error("Error initializing QR scanner:", err);
        setError("Failed to initialize QR scanner. Please refresh the page.");
      }
    };

    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeScanner();
    }, 500);

    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
        scannerRef.current = null;
      }
      setIsScannerInitialized(false);
    };
  }, [scanning, showImageCapture]);

  // Reset scanner when switching back to scanning
  useEffect(() => {
    if (scanning && !showImageCapture) {
      setIsScannerInitialized(false);
    }
  }, [scanning, showImageCapture]);

  // Request location permission and get current location
  useEffect(() => {
    async function getLocationPermission() {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        setLocationPermission(permission.state);

        permission.addEventListener('change', () => {
          setLocationPermission(permission.state);
        });

        if (permission.state === 'granted') {
          getCurrentLocation();
        }
      } catch (err) {
        console.error('Error checking location permission:', err);
        setLocationPermission('denied');
      }
    }

    getLocationPermission();
  }, []);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setError(null);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        setError('Unable to get your location. Please enable location services.');
        setIsGettingLocation(false);
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, []);

  function handleImageCaptured(file: File) {
    setCapturedImageFile(file);
    setShowImageCapture(false);
  }

  useEffect(() => {
    async function processQRCode() {
      if (!qrData || !validateResult || !capturedImageFile || !user) {
        return;
      }

      // Validate QR code result first
      if (!validateResult.valid) {
        setError(validateResult.error || "Invalid QR code.");
        setScanning(true);
        setQrData(null);
        setCapturedImageFile(null);
        setShowImageCapture(false);
        return;
      }

      if (!validateResult.sessionId) {
        setError("Session ID missing from QR validation result.");
        setScanning(true);
        setQrData(null);
        setCapturedImageFile(null);
        setShowImageCapture(false);
        return;
      }

      // Check if location is required and available
      if (validateResult.requiresLocation) {
        if (!currentLocation) {
          setError("Location access is required to mark attendance. Please enable location services.");
          setScanning(true);
          setQrData(null);
          setCapturedImageFile(null);
          setShowImageCapture(false);
          return;
        }

        // If location is required but not yet obtained, try to get it
        if (!currentLocation && !isGettingLocation) {
          getCurrentLocation();
          return;
        }
      }

      setScanning(false);

      try {
        const postUrl = await generateUploadUrl();

        const imageResult = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": capturedImageFile.type },
          body: capturedImageFile,
        });

        if (!imageResult.ok) {
          const errorBody = await imageResult.text();
          throw new Error(`Image upload failed: ${imageResult.statusText}. Server response: ${errorBody}`);
        }
        const { storageId } = await imageResult.json();
        if (!storageId) {
          throw new Error("Storage ID not found in image upload response.");
        }

        await markAttendance({
          sessionId: validateResult.sessionId as Id<"sessions">,
          liveImageId: storageId as Id<"_storage">,
          studentLocation: currentLocation || undefined
        });

        toast.success("Attendance marked successfully!");
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.");
        console.error(err);
      }
      // Reset state for the next scan attempt
      setScanning(true);
      setQrData(null);
      setCapturedImageFile(null);
      setShowImageCapture(false);
    }

    if (capturedImageFile && qrData && validateResult) {
      processQRCode();
    }
  }, [qrData, validateResult, capturedImageFile, user, markAttendance, generateUploadUrl, currentLocation, isGettingLocation, getCurrentLocation]);

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="text-red-500">Please log in to mark attendance</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Location Permission Status */}
      {locationPermission === "denied" && (
        <div className="w-full max-w-md p-4 bg-red-100 border border-red-400 text-red-700 rounded-md mb-4">
          <p className="font-medium">Location Access Required</p>
          <p className="text-sm">Please enable location services to mark attendance.</p>
          <button
            onClick={() => getCurrentLocation()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Enable Location
          </button>
        </div>
      )}

      {/* Location Loading State */}
      {isGettingLocation && (
        <div className="w-full max-w-md p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded-md mb-4">
          <p className="font-medium">Getting Location</p>
          <p className="text-sm">Please wait while we get your current location...</p>
        </div>
      )}

      {/* QR Reader Element - Added a container div with fixed dimensions */}
      {!showImageCapture && scanning && (
        <div className="w-full max-w-md">
          <div ref={qrReaderRef} id="qr-reader" className="w-full h-[300px]"></div>
        </div>
      )}
      
      {/* Image Capture Placeholder UI */}
      {showImageCapture && (
        <div className="w-full max-w-md">
          <ImageCapture
            onImageCaptured={handleImageCaptured}
            onCancel={() => {
              setShowImageCapture(false);
              setQrData(null);
              setCapturedImageFile(null);
              setScanning(true);
              setError(null);
            }}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Status Messages */}
      {!error && !scanning && !showImageCapture && qrData && !capturedImageFile && (
        <div className="text-blue-600 text-sm mt-2 font-medium">
          QR code recognized. Proceeding to image capture step...
        </div>
      )}

      {!error && !scanning && !showImageCapture && capturedImageFile && (
        <div className="text-green-600 text-sm mt-2 font-medium">
          Processing image and marking attendance... Please wait.
        </div>
      )}

      {/* Manual Upload Button */}
      {!showImageCapture && !qrData && (
        <button
          onClick={() => setShowImageCapture(true)}
          className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span>📷</span>
          <span>Upload Photo Manually</span>
        </button>
      )}
    </div>
  );
}

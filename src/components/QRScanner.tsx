import React, { useEffect, useState, useCallback } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ImageCapture } from "./ImageCapture"; // To be created later

export function QRScanner() {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [showImageCapture, setShowImageCapture] = useState(false);
  const [capturedImageFile, setCapturedImageFile] = useState<File | null>(null);

  const user = useQuery(api.auth.loggedInUser);
  const validateResult = useQuery(api.sessions.validateQRCode,
    qrData ? { encryptedData: qrData, studentLocation: undefined } : "skip"
  );
  const markAttendance = useMutation(api.sessions.markAttendance);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  useEffect(() => {
    let scannerInstance: Html5QrcodeScanner | null = null;
    if (!user || showImageCapture) {
      if (scannerInstance) {
        // This check might be redundant if scannerInstance is declared inside useEffect scope correctly
        // but as a safeguard:
        scannerInstance.clear().catch(console.error);
        scannerInstance = null;
      }
      return;
    }

    // Only initialize if not showing image capture and user is logged in
    if (!showImageCapture && user && document.getElementById("qr-reader")) {
      scannerInstance = new Html5QrcodeScanner("qr-reader", {
        qrbox: { width: 250, height: 250 },
        fps: 10,
      });
      scannerInstance.render(handleScan, handleError);
    }

    return () => {
      if (scannerInstance) {
        scannerInstance.clear().catch(err => {
          // Check if the error is about the element not being found, which can happen on rapid navigation
          if (!err.message.includes("HTML Element with id")) {
            console.error("Error clearing scanner:", err);
          }
        });
        scannerInstance = null;
      }
    };
  }, [user, showImageCapture]); // Dependency array

  async function handleScan(decodedText: string) {
    if (!user) {
      setError("Please log in to mark attendance");
      return;
    }
    setQrData(decodedText);
    setScanning(false);
    setError(null); // Clear previous errors
    setShowImageCapture(true);
  }

  const handleImageCaptured = useCallback((imageFile: File) => {
    setCapturedImageFile(imageFile);
    setShowImageCapture(false);
    // setError(null); // Clear any errors from QR scan phase if needed
  }, []);

  useEffect(() => {
    async function processQRCode() {
      if (!qrData || !validateResult || !capturedImageFile || !user) {
        return;
      }

      // Validate QR code result first
      if (!validateResult.valid) {
        setError(validateResult.error || "Invalid QR code.");
        setScanning(true); // Allow rescan
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

      setScanning(false); // Keep false to show processing message for upload/mark attendance

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
          studentLocation: undefined
        });

        toast.success("Attendance marked successfully with image!");
        setError(null); // Clear any previous errors on success
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred.");
        console.error(err);
      } finally {
        // Reset state for the next scan attempt regardless of success or failure
        setScanning(true);
        setQrData(null);
        setCapturedImageFile(null);
        setShowImageCapture(false);
      }
    }

    // Only run if we have a captured image and valid QR data
    if (capturedImageFile && qrData && validateResult) {
        processQRCode();
    }
  }, [qrData, validateResult, capturedImageFile, user, markAttendance, generateUploadUrl]);

  // html5-qrcode calls this with a string message for error
  function handleError(errorMessage: string) {
    console.warn("QR Scan Error reported by library:", errorMessage);
    // Only update UI error if we are in scanning phase and not already showing image capture
    if (scanning && !showImageCapture) {
      setError(`QR Scanning Error. Please try again.`);
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="text-red-500">Please log in to mark attendance</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* QR Reader Element: Only shown when not capturing image and scanning is true or qrData is null (initial state) */}
      {!showImageCapture && <div id="qr-reader" className="w-full max-w-md"></div>}
      
      {/* Image Capture Placeholder UI */}
      {showImageCapture && (
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

      {!error && !scanning && !showImageCapture && capturedImageFile && ( // This state means processing is happening
         <div className="text-green-600 text-sm mt-2 font-medium">
          Processing image and marking attendance... Please wait.
        </div>
      )}
    </div>
  );
}

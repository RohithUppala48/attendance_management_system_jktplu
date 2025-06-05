import React, { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function QRScanner() {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const user = useQuery(api.auth.loggedInUser);
  const validateResult = useQuery(api.sessions.validateQRCode, 
    qrData ? { encryptedData: qrData, studentLocation: undefined } : "skip"
  );
  const markAttendance = useMutation(api.sessions.markAttendance);

  useEffect(() => {
    if (!user) {
      setError("Please log in to mark attendance");
      return;
    }

    const scanner = new Html5QrcodeScanner("qr-reader", {
      qrbox: {
        width: 250,
        height: 250,
      },
      fps: 10,
    });

    scanner.render(handleScan, handleError);

    return () => {
      scanner.clear().catch(console.error);
    };
  }, [user]);

  async function handleScan(decodedText: string) {
    if (!user) {
      setError("Please log in to mark attendance");
      return;
    }

    setScanning(false);
    setError(null);
    setQrData(decodedText);
  }

  useEffect(() => {
    async function processQRCode() {
      if (!qrData || !validateResult || !validateResult.valid) return;

      try {
        await markAttendance({
          sessionId: validateResult.sessionId,
          studentLocation: undefined
        });

        toast.success("Attendance marked successfully!");
        setScanning(true);
        setQrData(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setScanning(true);
        setQrData(null);
      }
    }

    processQRCode();
  }, [qrData, validateResult, markAttendance]);

  function handleError(err: any) {
    console.warn(err);
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
      <div id="qr-reader" className="w-full max-w-md"></div>
      
      {error && (
        <div className="text-red-500 text-sm mt-2">
          {error}
        </div>
      )}

      {!scanning && (
        <div className="text-blue-500 text-sm mt-2">
          Processing QR code...
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";
import QRCode from "qrcode";

export function SessionManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Id<"courses"> | "">("");
  const [sessionName, setSessionName] = useState("");
  const [locationType, setLocationType] = useState<"gps" | "manual">("manual");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState("100");
  const [expiryMinutes, setExpiryMinutes] = useState("30");
  const [maxAttendanceTime, setMaxAttendanceTime] = useState("15");
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [remainingTimes, setRemainingTimes] = useState<Record<string, string>>({});

  const courses = useQuery(api.courses.getTeacherCourses);
  const activeSessions = useQuery(api.sessions.getActiveSessions);
  const createSession = useMutation(api.sessions.createSession);
  const endSession = useMutation(api.sessions.endSession);

  // Update remaining times every second
  useEffect(() => {
    if (!activeSessions) return;

    const updateRemainingTimes = () => {
      const now = Date.now();
      const newRemainingTimes: Record<string, string> = {};

      activeSessions.forEach(session => {
        const expiryTime = session.startTime + (session.qrData.expiryMinutes * 60 * 1000);
        const remaining = expiryTime - now;

        if (remaining <= 0) {
          newRemainingTimes[session._id] = "Expired";
        } else {
          const minutes = Math.floor(remaining / (60 * 1000));
          const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
          newRemainingTimes[session._id] = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      });

      setRemainingTimes(newRemainingTimes);
    };

    // Update immediately
    updateRemainingTimes();

    // Update every second
    const interval = setInterval(updateRemainingTimes, 1000);

    return () => clearInterval(interval);
  }, [activeSessions]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !sessionName) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      await createSession({
        courseId: selectedCourse as Id<"courses">,
        sessionName,
        location: {
          type: locationType,
          latitude: locationType === "gps" ? parseFloat(latitude) : undefined,
          longitude: locationType === "gps" ? parseFloat(longitude) : undefined,
          address: locationType === "manual" ? address : undefined,
          radius: locationType === "gps" ? parseInt(radius) : undefined,
        },
        expiryMinutes: parseInt(expiryMinutes),
        maxAttendanceTime: parseInt(maxAttendanceTime),
      });
      
      toast.success("Session created successfully!");
      setShowCreateForm(false);
      setSessionName("");
      setSelectedCourse("");
      setAddress("");
      setLatitude("");
      setLongitude("");
    } catch (error) {
      toast.error("Failed to create session");
      console.error(error);
    }
  };

  const handleEndSession = async (sessionId: Id<"sessions">) => {
    try {
      await endSession({ sessionId });
      toast.success("Session ended successfully!");
    } catch (error) {
      toast.error("Failed to end session");
      console.error(error);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
          toast.success("Location captured!");
        },
        (error) => {
          toast.error("Failed to get location");
          console.error(error);
        }
      );
    } else {
      toast.error("Geolocation is not supported by this browser");
    }
  };

  const showQRCodeModal = async (sessionId: string, encryptedData: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(encryptedData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrDataUrl);
      setShowQRCode(sessionId);
    } catch (error) {
      console.error("Error generating QR code:", error);
      toast.error("Failed to generate QR code");
    }
  };

  const closeQRCodeModal = () => {
    setShowQRCode(null);
    setQrCodeDataUrl(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Session Management</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
        >
          {showCreateForm ? "Cancel" : "Create Session"}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Create New Session</h3>
          <form onSubmit={handleCreateSession} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course *
                </label>
                <select
                  required
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value as Id<"courses">)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a course</option>
                  {courses?.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.name} ({course.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session Name *
                </label>
                <input
                  type="text"
                  required
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Lecture 1, Lab Session"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLocationType("manual")}
                  className={`p-3 rounded-lg border-2 text-center transition-colors ${
                    locationType === "manual"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium">Manual Address</div>
                  <div className="text-sm text-gray-500">Enter address manually</div>
                </button>
                <button
                  type="button"
                  onClick={() => setLocationType("gps")}
                  className={`p-3 rounded-lg border-2 text-center transition-colors ${
                    locationType === "gps"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium">GPS Location</div>
                  <div className="text-sm text-gray-500">Use GPS coordinates</div>
                </button>
              </div>
            </div>

            {locationType === "manual" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter the session location"
                />
              </div>
            )}

            {locationType === "gps" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Get Current Location
                  </button>
                  <span className="text-sm text-gray-500">or enter manually</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Latitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., 40.7128"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Longitude *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., -74.0060"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Radius (meters)
                    </label>
                    <input
                      type="number"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="100"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  QR Code Expiry (minutes)
                </label>
                <input
                  type="number"
                  value={expiryMinutes}
                  onChange={(e) => setExpiryMinutes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Late Time (minutes)
                </label>
                <input
                  type="number"
                  value={maxAttendanceTime}
                  onChange={(e) => setMaxAttendanceTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="15"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition-colors"
            >
              Create Session
            </button>
          </form>
        </div>
      )}

      {/* Active Sessions */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
        {activeSessions && activeSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeSessions.map((session) => {
              const course = courses?.find(c => c._id === session.courseId);
              const remainingTime = remainingTimes[session._id] || "Calculating...";
              const isExpired = remainingTime === "Expired";

              return (
                <div key={session._id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">{session.sessionName}</h4>
                      <p className="text-sm text-gray-600">{course?.name} ({course?.code})</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-sm px-2 py-1 rounded-full ${
                        isExpired 
                          ? "bg-red-100 text-red-800" 
                          : "bg-green-100 text-green-800"
                      }`}>
                        {isExpired ? "Expired" : "Active"}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        Time Left: {remainingTime}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <p><span className="font-medium">Started:</span> {new Date(session.startTime).toLocaleString()}</p>
                    <p><span className="font-medium">Location:</span> {
                      session.location.type === "gps" 
                        ? `GPS (${session.location.latitude}, ${session.location.longitude})`
                        : session.location.address
                    }</p>
                    <p><span className="font-medium">QR Expires:</span> {session.qrData.expiryMinutes} minutes</p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => showQRCodeModal(session._id, session.qrData.encryptedData)}
                      className={`flex-1 px-4 py-2 rounded-md text-sm transition-colors ${
                        isExpired
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700"
                      }`}
                      disabled={isExpired}
                    >
                      Show QR Code
                    </button>
                    <button 
                      onClick={() => handleEndSession(session._id)}
                      className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors text-sm"
                    >
                      End Session
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active sessions</h3>
            <p className="text-gray-600">Create a session to start taking attendance</p>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRCode && qrCodeDataUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-4">Session QR Code</h3>
              <img 
                src={qrCodeDataUrl} 
                alt="QR Code" 
                className="mx-auto mb-4 border rounded-lg"
              />
              <p className="text-sm text-gray-600 mb-4">
                Students can scan this QR code to mark their attendance
              </p>
              <button
                onClick={closeQRCodeModal}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

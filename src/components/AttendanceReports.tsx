import { useState } from "react";
import { useMutation, useQuery } from "convex/react"; // Added
import { api } from "../../convex/_generated/api"; // Added
import { Id } from "../../convex/_generated/dataModel"; // Added
import { toast } from "sonner"; // Added

// Helper component to display image from Convex storage
function AttendanceImage({ liveImageId, className = "w-16 h-16" }: { liveImageId?: Id<"_storage"> | null, className?: string }) {
  const imageUrl = useQuery(
    api.storage.getUrl,
    liveImageId ? { storageId: liveImageId } : "skip"
  );

  if (liveImageId === "skip" || liveImageId === undefined || liveImageId === null) {
    return <span className="text-xs text-gray-500">No Image</span>;
  }

  if (imageUrl === undefined) { // Still loading
    return <span className="text-xs text-gray-500">Loading image...</span>;
  }
  if (imageUrl === null) {
    return <span className="text-xs text-red-500">Error loading image.</span>;
  }
  return (
    <img
      src={imageUrl}
      alt="Student's live image"
      className={`object-cover rounded-md shadow-sm ${className}`}
      onError={(e) => (e.currentTarget.alt = "Error displaying image")}
    />
  );
}

// Image Preview Modal
function ImagePreviewModal({ 
  imageId, 
  onClose, 
  onVerify, 
  onReject, 
  onRevert,
  verificationStatus,
  isPending
}: { 
  imageId: Id<"_storage">, 
  onClose: () => void,
  onVerify: (comment: string) => void,
  onReject: (comment: string) => void,
  onRevert: () => void,
  verificationStatus?: "pending" | "verified" | "rejected",
  isPending: boolean
}) {
  const [comment, setComment] = useState("");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Attendance Image Verification</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="mb-4">
          <AttendanceImage liveImageId={imageId} className="w-full h-64" />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Verification Comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Add a comment about the verification..."
          />
        </div>

        <div className="flex justify-end space-x-2">
          {verificationStatus === "pending" ? (
            <>
              <button
                onClick={() => onVerify(comment)}
                disabled={isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                Verify
              </button>
              <button
                onClick={() => onReject(comment)}
                disabled={isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </>
          ) : (
            <button
              onClick={onRevert}
              disabled={isPending}
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              Revert to Pending
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AttendanceReports() {
  const [selectedCourse, setSelectedCourse] = useState<Id<"courses"> | "">("");
  const [selectedSession, setSelectedSession] = useState<Id<"sessions"> | "">("");
  const [selectedAttendance, setSelectedAttendance] = useState<{ id: Id<"attendance">, imageId: Id<"_storage"> } | null>(null);

  const courses = useQuery(api.courses.getTeacherCourses);
  // Assuming a query like getSessionsForCourse exists or will be created.
  // For now, let's use a placeholder or assume it might come from another source if not directly queried.
  // If `api.reports.getSessionsForCourse` is not available, this part needs adjustment.
  // For the purpose of this task, we'll assume a way to get sessions for the selected course.
  const sessions = useQuery(
     api.reports.getSessionsForCourse, // Placeholder if this specific query doesn't exist
     selectedCourse ? { courseId: selectedCourse as Id<"courses"> } : "skip"
  );

  const attendanceRecords = useQuery(
    api.sessions.getSessionAttendance,
    selectedSession ? { sessionId: selectedSession as Id<"sessions"> } : "skip"
  );

  const verifyImageMutation = useMutation(api.sessions.verifyImage);

  async function handleVerify(attendanceId: Id<"attendance">, status: "verified" | "rejected" | "pending", comment: string = "") {
    try {
      await verifyImageMutation({ attendanceId, status, comment });
      toast.success(`Image status updated to ${status}.`);
      setSelectedAttendance(null); // Close the modal
    } catch (error) {
      console.error("Failed to verify image:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update status.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Attendance Verification</h2>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Select Course and Session</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Course *
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value as Id<"courses">);
                setSelectedSession("");
              }}
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
              Session *
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value as Id<"sessions">)}
              disabled={!selectedCourse || !sessions || sessions.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a session</option>
              {sessions?.map((session: any) => ( // Type 'any' for session if structure is not strictly defined from query
                <option key={session._id} value={session._id}>
                  {session.sessionName} - {new Date(session.startTime).toLocaleString()}
                </option>
              ))}
              {sessions && sessions.length === 0 && selectedCourse && (
                <option value="" disabled>No sessions found for this course.</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {selectedSession && attendanceRecords && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">
            Verify Attendance for Session
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marked At</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Live Image</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verification Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record) => {
                  const verificationStatus = record.verificationStatus || "pending";
                  let statusColorClass = "bg-gray-100 text-gray-800";
                  if (verificationStatus === "verified") statusColorClass = "bg-green-100 text-green-800";
                  else if (verificationStatus === "rejected") statusColorClass = "bg-red-100 text-red-800";
                  else if (verificationStatus === "pending") statusColorClass = "bg-yellow-100 text-yellow-800";

                  return (
                    <tr key={record._id}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{record.profile?.name || record.user?.email || "N/A"}</div>
                        <div className="text-sm text-gray-500">{record.user?.email || ""}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{record.profile?.rollNumber || "N/A"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{new Date(record.markedAt).toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === "present" ? "bg-green-100 text-green-800" :
                          record.status === "late" ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {record.liveImageId ? (
                          <button
                            onClick={() => setSelectedAttendance({ id: record._id, imageId: record.liveImageId! })}
                            className="hover:opacity-75 transition-opacity"
                          >
                            <AttendanceImage liveImageId={record.liveImageId} />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No Image</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColorClass}`}>
                          {verificationStatus.charAt(0).toUpperCase() + verificationStatus.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm space-x-2">
                        {record.liveImageId && (
                          <button
                            onClick={() => setSelectedAttendance({ id: record._id, imageId: record.liveImageId! })}
                            className="px-2 py-1 text-xs text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                          >
                            View Image
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {attendanceRecords.length === 0 && (
                <div className="text-center py-6 text-gray-500">No attendance records found for this session, or data is still loading.</div>
            )}
          </div>
        </div>
      )}

      {!selectedSession && selectedCourse && (
         <div className="text-center py-12">
          <div className="text-gray-400 text-4xl mb-3">📄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Session</h3>
          <p className="text-gray-600">Choose a session to view and verify attendance images.</p>
        </div>
      )}
      {!selectedCourse && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Course First</h3>
          <p className="text-gray-600">Choose a course to load available sessions for verification.</p>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedAttendance && (
        <ImagePreviewModal
          imageId={selectedAttendance.imageId}
          onClose={() => setSelectedAttendance(null)}
          onVerify={(comment) => handleVerify(selectedAttendance.id, "verified", comment)}
          onReject={(comment) => handleVerify(selectedAttendance.id, "rejected", comment)}
          onRevert={() => handleVerify(selectedAttendance.id, "pending")}
          verificationStatus={attendanceRecords?.find(r => r._id === selectedAttendance.id)?.verificationStatus}
          isPending={verifyImageMutation.isPending}
        />
      )}
    </div>
  );
}

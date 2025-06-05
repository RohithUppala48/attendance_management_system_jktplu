import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export function ProfileSetup() {
  const [role, setRole] = useState<"teacher" | "student" | "">("");
  const [institutionalId, setInstitutionalId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const createProfile = useMutation(api.users.createUserProfile);
  const userProfile = useQuery(api.users.getUserProfile);

  // Load existing profile data if available
  useEffect(() => {
    if (userProfile) {
      setRole(userProfile.role);
      setInstitutionalId(userProfile.institutionalId || "");
      setRollNumber(userProfile.rollNumber || "");
      setDepartment(userProfile.department || "");
      setSemester(userProfile.semester?.toString() || "");
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toast.error("Please select a role");
      return;
    }

    setIsLoading(true);
    try {
      await createProfile({
        role: role as "teacher" | "student",
        institutionalId: institutionalId || undefined,
        rollNumber: role === "student" ? rollNumber || undefined : undefined,
        department: department || undefined,
        semester: role === "student" && semester ? parseInt(semester) : undefined,
      });
      toast.success(userProfile ? "Profile updated successfully!" : "Profile created successfully!");
      if (role === "teacher") {
        navigate("/teacher-dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save profile");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          {userProfile ? "Update Your Profile" : "Complete Your Profile"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("teacher")}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  role === "teacher"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium">Teacher</div>
                <div className="text-sm text-gray-500">Create & manage classes</div>
              </button>
              <button
                type="button"
                onClick={() => setRole("student")}
                className={`p-3 rounded-lg border-2 text-center transition-colors ${
                  role === "student"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium">Student</div>
                <div className="text-sm text-gray-500">Mark attendance</div>
              </button>
            </div>
          </div>

          {role === "teacher" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Institutional ID
              </label>
              <input
                type="text"
                value={institutionalId}
                onChange={(e) => setInstitutionalId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your institutional ID"
              />
            </div>
          )}

          {role === "student" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Roll Number
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your roll number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Semester
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your department"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !role}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Saving..." : (userProfile ? "Update Profile" : "Complete Setup")}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Id } from "../../convex/_generated/dataModel";

export function CourseManagement() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Id<"courses"> | null>(null);
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [enrollmentEmail, setEnrollmentEmail] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    department: "",
    semester: "",
    description: "",
  });

  const courses = useQuery(api.courses.getTeacherCourses);
  const createCourse = useMutation(api.courses.createCourse);
  const enrollStudent = useMutation(api.courses.enrollStudent);
  const courseStudents = useQuery(
    api.courses.getCourseStudents,
    selectedCourse ? { courseId: selectedCourse } : "skip"
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCourse({
        name: formData.name,
        code: formData.code,
        department: formData.department,
        semester: parseInt(formData.semester),
        description: formData.description || undefined,
      });
      toast.success("Course created successfully!");
      setFormData({ name: "", code: "", department: "", semester: "", description: "" });
      setShowCreateForm(false);
    } catch (error) {
      toast.error("Failed to create course");
      console.error(error);
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    try {
      await enrollStudent({
        courseId: selectedCourse,
        studentEmail: enrollmentEmail,
      });
      toast.success("Student enrolled successfully!");
      setEnrollmentEmail("");
      setShowEnrollmentModal(false);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to enroll student");
      }
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">My Courses</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          {showCreateForm ? "Cancel" : "Create Course"}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Create New Course</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Data Structures"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Code *
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., CS201"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department *
              </label>
              <input
                type="text"
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Computer Science"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Semester *
              </label>
              <select
                required
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                  <option key={sem} value={sem}>{sem}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Course description (optional)"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Course
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Courses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses?.map((course) => (
          <div key={course._id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{course.name}</h3>
                <p className="text-sm text-gray-600">{course.code}</p>
              </div>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                Sem {course.semester}
              </span>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Department:</span> {course.department}</p>
              {course.description && (
                <p><span className="font-medium">Description:</span> {course.description}</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    setSelectedCourse(course._id);
                    setShowEnrollmentModal(true);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View Students
                </button>
                <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                  Start Session
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {courses?.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses yet</h3>
          <p className="text-gray-600">Create your first course to get started</p>
        </div>
      )}

      {/* Enrollment Modal */}
      {showEnrollmentModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Manage Course Enrollments</h3>
              <button
                onClick={() => {
                  setShowEnrollmentModal(false);
                  setSelectedCourse(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Enroll New Student Form */}
            <form onSubmit={handleEnrollStudent} className="mb-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Enter the email address of the student you want to enroll. The student must have already signed up and completed their profile setup.
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={enrollmentEmail}
                    onChange={(e) => setEnrollmentEmail(e.target.value)}
                    placeholder="Enter student email"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Enroll Student
                  </button>
                </div>
              </div>
            </form>

            {/* Enrolled Students List */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Enrolled Students</h4>
              {courseStudents?.length === 0 ? (
                <p className="text-gray-500">No students enrolled yet</p>
              ) : (
                <div className="space-y-2">
                  {courseStudents?.map((student) => {
                    if (!student.user || !student.profile) return null;
                    return (
                      <div
                        key={student.user._id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div>
                          <p className="font-medium">{student.user.email}</p>
                          {student.profile.rollNumber && (
                            <p className="text-sm text-gray-600">
                              Roll No: {student.profile.rollNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CourseManagement } from "./CourseManagement";
import { SessionManagement } from "./SessionManagement";
import { AttendanceReports } from "./AttendanceReports";

type Tab = "courses" | "sessions" | "reports";

export function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("courses");
  const courses = useQuery(api.courses.getTeacherCourses);

  const tabs = [
    { id: "courses" as Tab, label: "Courses", icon: "📚" },
    { id: "sessions" as Tab, label: "Sessions", icon: "🎯" },
    { id: "reports" as Tab, label: "Reports", icon: "📊" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Teacher Dashboard</h1>
        <p className="text-gray-600">Manage your courses and track attendance</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "courses" && <CourseManagement />}
        {activeTab === "sessions" && <SessionManagement />}
        {activeTab === "reports" && <AttendanceReports />}
      </div>
    </div>
  );
}

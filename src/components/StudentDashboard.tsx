import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { QRScanner } from "./QRScanner";
import { AttendanceHistory } from "./AttendanceHistory";

type Tab = "scan" | "history";

export function StudentDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("scan");
  const courses = useQuery(api.courses.getStudentCourses);
  const userProfile = useQuery(api.users.getUserProfile);

  const tabs = [
    { id: "scan" as Tab, label: "Scan QR", icon: "📱" },
    { id: "history" as Tab, label: "History", icon: "📋" },
  ];

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Student Dashboard</h1>
        <p className="text-gray-600">Mark your attendance and view your records</p>
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
        {activeTab === "scan" && <QRScanner />}
        {activeTab === "history" && <AttendanceHistory />}
      </div>
    </div>
  );
}

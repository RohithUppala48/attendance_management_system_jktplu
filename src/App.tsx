import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { StudentDashboard } from "./components/StudentDashboard";
import { ProfileSetup } from "./components/ProfileSetup";
import { Routes, Route, Navigate } from "react-router-dom";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-blue-600">AttendanceTracker</h2>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      <main className="flex-1">
        <Content />
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const currentUser = useQuery(api.users.getCurrentUser);
  const userProfile = useQuery(api.users.getUserProfile);

  if (currentUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Authenticated>
        {!userProfile ? (
          <ProfileSetup />
        ) : (
          <Routes>
            <Route path="/" element={
              <Navigate to={userProfile.role === "teacher" ? "/teacher-dashboard" : "/student-dashboard"} replace />
            } />
            <Route path="/teacher-dashboard" element={
              userProfile.role === "teacher" ? (
                <TeacherDashboard />
              ) : (
                <Navigate to="/" replace />
              )
            } />
            <Route path="/student-dashboard" element={
              userProfile.role === "student" ? (
                <StudentDashboard />
              ) : (
                <Navigate to="/" replace />
              )
            } />
          </Routes>
        )}
      </Authenticated>

      <Unauthenticated>
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Attendance Management System
            </h1>
            <p className="text-lg text-gray-600">
              Sign in to access your dashboard
            </p>
          </div>
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}

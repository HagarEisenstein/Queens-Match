import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";
import theme from "./theme";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login";
import Profile from "./components/Profile";
import Register from "./components/Register";
import MentorList from "./components/MentorList";
import MentorDetail from "./components/MentorDetail";
import MentorProfile from "./components/MentorProfile";
import RoleGuard from "./components/RoleGuard";
import MeetingArrivalPage from "./components/MeetingArrivalPage";
import MeetingOutcomePage from "./components/MeetingOutcomePage";
import MeetingFeedbackPage from "./components/MeetingFeedbackPage";
import { NotificationProvider } from "./notifications/NotificationContext";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AuthProvider>
          <NotificationProvider><Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/mentors" element={<MentorList />} />
                <Route path="/mentors/:id" element={<MentorDetail />} />
                <Route
                  path="/mentor-profile"
                  element={
                    <RoleGuard roles={["mentor"]}>
                      <MentorProfile />
                    </RoleGuard>
                  }
                />
                <Route path="/meetings/:id/arrival" element={<MeetingArrivalPage />} />
                <Route path="/meetings/:id/outcome" element={<MeetingOutcomePage />} />
                <Route path="/meetings/:id/feedback" element={<MeetingFeedbackPage />} />
              </Route>
            </Route>
          </Routes></NotificationProvider>
        </AuthProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;

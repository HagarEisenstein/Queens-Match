import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { 
  ThemeProvider, 
  CssBaseline
} from "@mui/material";
import theme from "./theme";
import Dashboard from "./components/Dashboard";
import { AuthProvider } from "./context/AuthContext";
import RoleGuard from "./components/RoleGuard";
import MentorList from "./components/MentorList";
import MentorDetail from "./components/MentorDetail";
import MentorProfile from "./components/MentorProfile";

 


function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/mentors" element={<MentorList />} />
            <Route path="/mentors/:id" element={<MentorDetail />} />
            <Route
              path="/mentor-profile"
              element={<RoleGuard><MentorProfile /></RoleGuard>}
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

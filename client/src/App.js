import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { 
  ThemeProvider, 
  CssBaseline
} from "@mui/material";
import theme from "./theme";
import Dashboard from "./components/Dashboard";
import { AuthProvider } from "./context/AuthContext";

 


function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

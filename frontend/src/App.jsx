// frontend/src/App.jsx
import React, { useState } from "react";
import { ToastProvider } from "./components/Toast";
import { ThemeProvider } from "./contexts/ThemeContext";
import AuthPageExtracted from "./pages/AuthPage";
import HomePageExtracted from "./pages/HomePage";
import EditorPage from "./pages/EditorPage";
import ThemeSwitcher from "./components/ThemeSwitcher";
import "./index.css";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("jwtToken")
  );
  const sessionId = new URLSearchParams(window.location.search).get(
    "sessionId"
  );

  return (
    <ToastProvider>
      <ThemeProvider>
        {!isAuthenticated ? (
          <AuthPageExtracted
            onLoginSuccess={() => setIsAuthenticated(true)}
            ThemeSwitcher={ThemeSwitcher}
          />
        ) : sessionId ? (
          <EditorPage sessionId={sessionId} />
        ) : (
          <HomePageExtracted ThemeSwitcher={ThemeSwitcher} />
        )}
      </ThemeProvider>
    </ToastProvider>
  );
}

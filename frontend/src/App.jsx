// frontend/src/App.jsx
import React, { useState, useEffect } from "react";
import { ToastProvider } from "./components/Toast";
import { ThemeProvider } from "./contexts/ThemeContext";
import LandingPage from "./pages/LandingPage";
import AuthPageExtracted from "./pages/AuthPage";
import HomePageExtracted from "./pages/HomePage";
import EditorPage from "./pages/EditorPage";
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
import ThemeSwitcher from "./components/ThemeSwitcher";
import "./index.css";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem("jwtToken")
  );
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("sessionId");
  const isAdminView = currentPath === "/admin" || searchParams.get("admin") === "true";
  const isAuthView = showAuth || currentPath === "/login" || searchParams.get("auth") === "true";

  return (
    <ToastProvider>
      <ThemeProvider>
        <React.Suspense fallback={
          <div className="h-screen w-screen flex items-center justify-center font-bold text-lg" style={{ backgroundColor: 'var(--panel-bg-color)', color: 'var(--text-color)' }}>
            <span className="codicon codicon-loading codicon-modifier-spin mr-2" /> Carregando...
          </div>
        }>
          {sessionId ? (
            <EditorPage sessionId={sessionId} />
          ) : isAdminView ? (
            !isAuthenticated ? (
              <AuthPageExtracted
                onLoginSuccess={() => {
                  setIsAuthenticated(true);
                  setShowAuth(false);
                }}
                onBack={() => {
                  setShowAuth(false);
                  window.location.href = "/";
                }}
                ThemeSwitcher={ThemeSwitcher}
              />
            ) : (
              <AdminDashboard />
            )
          ) : !isAuthenticated ? (
            isAuthView ? (
              <AuthPageExtracted
                onLoginSuccess={() => {
                  setIsAuthenticated(true);
                  setShowAuth(false);
                }}
                onBack={() => setShowAuth(false)}
                ThemeSwitcher={ThemeSwitcher}
              />
            ) : (
              <LandingPage
                onOpenAuth={() => setShowAuth(true)}
                ThemeSwitcher={ThemeSwitcher}
              />
            )
          ) : (
            <HomePageExtracted ThemeSwitcher={ThemeSwitcher} />
          )}
        </React.Suspense>
      </ThemeProvider>
    </ToastProvider>
  );
}


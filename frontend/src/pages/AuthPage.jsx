import React, { useState, useEffect } from "react";

export default function AuthPage({ onLoginSuccess, ThemeSwitcher }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null);

  // States for dynamic OAuth Client IDs loaded from the backend
  const [githubClientId, setGithubClientId] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [oauthConfigLoaded, setOauthConfigLoaded] = useState(false);

  // Load OAuth Config from the user-service backend
  useEffect(() => {
    const fetchOauthConfig = async () => {
      try {
        const res = await fetch("/api/users/oauth/config");
        if (res.ok) {
          const data = await res.json();
          setGithubClientId(data.githubClientId || "");
          setGoogleClientId(data.googleClientId || "");
        }
      } catch (e) {
        console.error("Falha ao carregar configuração OAuth:", e);
      } finally {
        setOauthConfigLoaded(true);
      }
    };
    fetchOauthConfig();
  }, []);

  // Handle OAuth callback (GitHub sends ?code=... in the URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthProvider = localStorage.getItem("oauth_provider");
    if (code && oauthProvider === "github") {
      localStorage.removeItem("oauth_provider");
      window.history.replaceState({}, document.title, window.location.pathname);
      handleGitHubCallback(code);
    }
  }, []);

  const handleGitHubCallback = async (code) => {
    setOauthLoading("github");
    setError(null);
    try {
      const res = await fetch("/api/users/oauth/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      localStorage.setItem("jwtToken", data.token);
      try {
        const payload = JSON.parse(atob(data.token.split(".")[1]));
        localStorage.setItem("username", payload.sub || "User");
      } catch (_) {
        localStorage.setItem("username", "User");
      }
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleGitHubLogin = () => {
    if (!githubClientId) {
      setError("GitHub OAuth não está configurado no backend (.env)");
      return;
    }
    setOauthLoading("github");
    localStorage.setItem("oauth_provider", "github");
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  };

  const handleGoogleLogin = async (googleResponse) => {
    setOauthLoading("google");
    setError(null);
    try {
      const res = await fetch("/api/users/oauth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: googleResponse.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      localStorage.setItem("jwtToken", data.token);
      try {
        const payload = JSON.parse(atob(data.token.split(".")[1]));
        localStorage.setItem("username", payload.sub || "User");
      } catch (_) {
        localStorage.setItem("username", "User");
      }
      onLoginSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setOauthLoading(null);
    }
  };

  // Google GSI script loader
  useEffect(() => {
    if (!googleClientId) return;
    const existingScript = document.getElementById("google-gsi-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => initGoogleButton(googleClientId);
      document.head.appendChild(script);
    } else {
      initGoogleButton(googleClientId);
    }
  }, [googleClientId]);

  const initGoogleButton = (clientId) => {
    const googleBtnContainer = document.getElementById("google-signin-btn");
    if (window.google && googleBtnContainer && clientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleLogin,
        });
        window.google.accounts.id.renderButton(googleBtnContainer, {
          theme: "outline",
          size: "large",
          width: "100%",
          text: "signin_with",
          shape: "rectangular",
        });
      } catch (_) { /* Google SDK not ready */ }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const url = isLoginView ? "/api/users/login" : "/api/users/register";
    const body = isLoginView
      ? { username, password }
      : { username, email, password };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Erro ${res.status}`);
      if (isLoginView) {
        const { token } = JSON.parse(text);
        localStorage.setItem("jwtToken", token);
        localStorage.setItem("username", username);
        onLoginSuccess();
      } else {
        setIsLoginView(true);
        setError("Registro realizado! Faça o login.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <div className="absolute top-6 right-6">
        {ThemeSwitcher && <ThemeSwitcher />}
      </div>
      <div
        className="w-full max-w-md p-8 space-y-6 border-2 glass-panel neo-shadow"
        style={{
          backgroundColor: "var(--panel-bg-color)",
          borderColor: "var(--panel-border-color)",
        }}
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold" style={{ color: "var(--primary-color)" }}>
            TeamCode
          </h1>
          <p className="mt-2" style={{ color: "var(--text-muted-color)" }}>
            {isLoginView ? "Bem-vindo de volta!" : "Crie sua conta"}
          </p>
        </div>

        {isLoginView && (githubClientId || googleClientId) && (
          <div className="space-y-3">
            {githubClientId && (
              <button
                onClick={handleGitHubLogin}
                disabled={oauthLoading === "github"}
                className="w-full font-bold py-3 border-2 flex items-center justify-center gap-3 neo-shadow-button hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{
                  backgroundColor: "#24292e",
                  color: "#ffffff",
                  borderColor: "var(--panel-border-color)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                {oauthLoading === "github" ? "Conectando..." : "Entrar com GitHub"}
              </button>
            )}

            {googleClientId && (
              <div id="google-signin-btn" className="w-full flex justify-center" style={{ minHeight: "44px" }} />
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--panel-border-color)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-muted-color)" }}>OU</span>
              <div className="flex-1 h-px" style={{ backgroundColor: "var(--panel-border-color)" }} />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nome de usuário"
            required
            className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: "var(--panel-border-color)",
              "--tw-ring-color": "var(--primary-color)",
              color: "var(--text-color)",
            }}
          />
          {!isLoginView && (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
              style={{
                backgroundColor: "var(--input-bg-color)",
                borderColor: "var(--panel-border-color)",
                "--tw-ring-color": "var(--primary-color)",
                color: "var(--text-color)",
              }}
            />
          )}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            required
            className="w-full px-4 py-3 border-2 focus:outline-none focus:ring-2"
            style={{
              backgroundColor: "var(--input-bg-color)",
              borderColor: "var(--panel-border-color)",
              "--tw-ring-color": "var(--primary-color)",
              color: "var(--text-color)",
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full font-bold py-3 border-2 disabled:opacity-50 neo-shadow-button"
            style={{
              backgroundColor: "var(--button-bg-color)",
              color: "var(--button-text-color)",
              borderColor: "var(--panel-border-color)",
            }}
          >
            {isLoading ? "Processando..." : isLoginView ? "Entrar" : "Registrar"}
          </button>
        </form>
        {error && (
          <div
            className="p-3 border-2"
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderColor: "rgba(239, 68, 68, 0.5)",
              color: "rgb(252, 165, 165)",
            }}
          >
            {error}
          </div>
        )}
        <p className="text-center text-sm" style={{ color: "var(--text-muted-color)" }}>
          {isLoginView ? "Não tem conta?" : "Já tem conta?"}
          <button
            type="button"
            onClick={() => { setIsLoginView(!isLoginView); setError(null); }}
            className="font-bold underline ml-2"
            style={{ color: "var(--primary-color)" }}
          >
            {isLoginView ? "Registre-se" : "Faça o login"}
          </button>
        </p>
      </div>
    </div>
  );
}

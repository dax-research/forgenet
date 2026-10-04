import { useState } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Code2, Lock, Mail, MailCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import Button from "../components/Button";
import Input from "../components/Input";
import Card from "../components/Card";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  // If already authenticated, redirect
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Invalid credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Enter your email address first, then choose \u201cForgot password?\u201d.");
      return;
    }

    try {
      setResetSending(true);
      const res = await authService.forgotPassword(email.trim());
      // The backend always answers with the same generic message.
      setResetSent(true);
      setError(res?.message || "If an account exists for this email, a reset link has been sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not process the request. Please try again.");
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        backgroundColor: "var(--bg)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "22px",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}
        >
          <div className="topbar-logo-icon" style={{ width: "32px", height: "32px" }}>
            <Code2 size={18} strokeWidth={2.5} />
          </div>
          <span>ForgeNet</span>
        </Link>
        <p style={{ marginTop: "6px", fontSize: "14px", color: "var(--text-secondary)" }}>
          Sign in to your developer account
        </p>
      </div>

      <Card style={{ width: "100%", maxWidth: "380px", padding: "20px" }}>
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              borderRadius: "var(--radius-btn)",
              backgroundColor: resetSent ? "var(--accent-subtle)" : "var(--danger-bg)",
              border: `1px solid ${resetSent ? "#B4D2FB" : "var(--danger-border)"}`,
              color: resetSent ? "var(--accent)" : "var(--danger)",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {resetSent ? (
              <MailCheck size={16} style={{ flexShrink: 0 }} />
            ) : (
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
            )}
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input
            label="Email address"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="developer@example.com"
            icon={Mail}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            icon={Lock}
            required
            autoComplete="current-password"
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "-4px" }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetSending || resetSent}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "12.5px",
                fontWeight: 500,
                color: "var(--accent)",
                cursor: resetSent ? "default" : "pointer",
              }}
            >
              {resetSent ? "Reset link sent" : "Forgot password?"}
            </button>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            style={{ width: "100%", marginTop: "6px" }}
          >
            Sign in
          </Button>
        </form>
      </Card>

      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          marginTop: "16px",
          padding: "14px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          backgroundColor: "var(--surface)",
          textAlign: "center",
          fontSize: "13px",
          color: "var(--text-secondary)",
        }}
      >
        New to ForgeNet?{" "}
        <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Create an account
        </Link>
      </div>
    </div>
  );
}
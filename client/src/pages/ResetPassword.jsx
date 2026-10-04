import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Code2, Lock, AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import { authService } from "../services/auth.service";
import Button from "../components/Button";
import Input from "../components/Input";
import Card from "../components/Card";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is invalid. Please request a new one.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "This reset link is invalid or has expired. Please request a new one."
      );
    } finally {
      setSubmitting(false);
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
          Choose a new password for your account
        </p>
      </div>

      <Card style={{ width: "100%", maxWidth: "380px", padding: "20px" }}>
        {success ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <CheckCircle2 size={36} style={{ color: "var(--success)", marginBottom: "10px" }} />
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
              Password updated
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "6px 0 16px" }}>
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Link to="/login">
              <Button variant="primary" style={{ width: "100%" }}>
                Back to Login
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-btn)",
                  backgroundColor: "var(--danger-bg)",
                  border: "1px solid var(--danger-border)",
                  color: "var(--danger)",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {!token && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-btn)",
                  backgroundColor: "var(--accent-subtle)",
                  border: "1px solid #B4D2FB",
                  color: "var(--accent)",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                <MailCheck size={16} style={{ flexShrink: 0 }} />
                <span>Open the reset link from your email to continue.</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <Input
                label="New password"
                type="password"
                name="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                icon={Lock}
                required
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
              />

              <Input
                label="Confirm new password"
                type="password"
                name="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                icon={Lock}
                required
                autoComplete="new-password"
              />

              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={!token}
                style={{ width: "100%", marginTop: "6px" }}
              >
                Reset Password
              </Button>
            </form>
          </>
        )}
      </Card>

      <div style={{ marginTop: "16px", fontSize: "13px", color: "var(--text-secondary)" }}>
        <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Back to login
        </Link>
      </div>
    </div>
  );
}

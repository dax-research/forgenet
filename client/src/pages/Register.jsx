import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Code2, Lock, Mail, User, AlertCircle } from "lucide-react";
import GithubIcon from "../components/GithubIcon";
import { useAuth } from "../context/AuthContext";
import Button from "../components/Button";
import Input from "../components/Input";
import Card from "../components/Card";

export default function Register() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    bio: "",
    skills: "",
    githubUrl: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register, login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (!formData.email.trim()) {
      setError("Please enter a valid email.");
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        bio: formData.bio.trim() || undefined,
        skills: formData.skills
          ? formData.skills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        githubUrl: formData.githubUrl.trim() || undefined,
      };

      await register(payload);
      // Auto login after registration
      await login(payload.email, payload.password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Registration failed. Try again."
      );
    } finally {
      setLoading(false);
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
        padding: "32px 16px",
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
          Join the developer collaboration community
        </p>
      </div>

      <Card style={{ width: "100%", maxWidth: "420px", padding: "20px" }}>
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input
            label="Full name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Linus Torvalds"
            icon={User}
            required
          />

          <Input
            label="Email address"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="developer@example.com"
            icon={Mail}
            required
          />

          <Input
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="At least 8 characters"
            icon={Lock}
            required
            helper="Use 8 or more characters with a mix of letters and numbers"
          />

          <Input
            label="Technical skills (comma separated)"
            name="skills"
            value={formData.skills}
            onChange={handleChange}
            placeholder="React, TypeScript, Go, Docker"
          />

          <Input
            label="GitHub Profile URL (optional)"
            name="githubUrl"
            value={formData.githubUrl}
            onChange={handleChange}
            placeholder="https://github.com/username"
            icon={GithubIcon}
          />

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            style={{ width: "100%", marginTop: "6px" }}
          >
            Create account
          </Button>
        </form>
      </Card>

      <div
        style={{
          width: "100%",
          maxWidth: "420px",
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
        Already have an account?{" "}
        <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
          Sign in
        </Link>
      </div>
    </div>
  );
}
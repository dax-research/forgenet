import { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import Card from "../components/Card";
import Input from "../components/Input";
import Button from "../components/Button";
import Avatar from "../components/Avatar";
import { Check, AlertCircle, Camera, Trash2, Upload } from "lucide-react";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB, matches the server limit
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function Settings() {
  const { user, updateProfile, removeProfilePhoto } = useAuth();
  const fileInputRef = useRef(null);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState("");
  const [removingAvatar, setRemovingAvatar] = useState(false);

  // Profile Form
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    bio: user?.bio || "",
    skills: Array.isArray(user?.skills) ? user.skills.join(", ") : "",
    githubUrl: user?.githubUrl || "",
    portfolioUrl: user?.portfolioUrl || "",
    isJobSeeking: !!user?.isJobSeeking,
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      setProfileSuccess(false);

      const payload = {
        name: profileData.name.trim(),
        bio: profileData.bio.trim(),
        skills: profileData.skills
          ? profileData.skills.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        githubUrl: profileData.githubUrl.trim(),
        portfolioUrl: profileData.portfolioUrl.trim(),
        isJobSeeking: profileData.isJobSeeking,
      };

      setAvatarError("");
      await updateProfile(payload, avatarFile ?? undefined);
      handleClearAvatarSelection();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      setAvatarError(
        err.response?.data?.message || "Could not save your profile."
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAvatarSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError("");
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Unsupported file type. Please choose a JPG, PNG, or WEBP image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image is too large. Maximum size is 5 MB.");
      e.target.value = "";
      return;
    }

    // Show the chosen image immediately, before the upload completes.
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFile(file);
  };

  const handleClearAvatarSelection = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAvatar = async () => {
    try {
      setRemovingAvatar(true);
      setAvatarError("");
      await removeProfilePhoto();
      handleClearAvatarSelection();
    } catch (err) {
      setAvatarError(
        err.response?.data?.message || "Could not remove the profile photo."
      );
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordError("Both current and new passwords are required.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    try {
      setPasswordSaving(true);
      setPasswordError("");
      setPasswordSuccess(false);

      const res = await authService.updatePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || err.message || "Failed to update password."
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>
          Settings
        </h1>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "2px" }}>
          Manage your developer profile and account preferences
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Profile Card */}
        <Card style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
            Profile Information
          </h2>

          {profileSuccess && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                backgroundColor: "var(--success-bg)",
                border: "1px solid var(--success-border)",
                borderRadius: "var(--radius-btn)",
                color: "var(--success)",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              <Check size={16} />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {avatarError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                backgroundColor: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-btn)",
                color: "var(--danger)",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              <AlertCircle size={16} />
              <span>{avatarError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Profile Photo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                paddingBottom: "14px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ position: "relative" }}>
                <Avatar
                  src={avatarPreview || user?.profileImage}
                  name={profileData.name || user?.name}
                  size={72}
                />
                <div
                  style={{
                    position: "absolute",
                    right: "-2px",
                    bottom: "-2px",
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    backgroundColor: "var(--accent)",
                    border: "2px solid var(--surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                  }}
                >
                  <Camera size={13} style={{ color: "#fff" }} />
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                  Profile photo
                </p>
                <p style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                  JPG, PNG or WEBP. Maximum 5 MB.
                </p>

                <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarSelected}
                    style={{ display: "none" }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={Upload}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarFile ? "Choose a different photo" : "Upload photo"}
                  </Button>

                  {avatarFile && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleClearAvatarSelection}>
                      Cancel
                    </Button>
                  )}

                  {!avatarFile && user?.profileImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      loading={removingAvatar}
                      onClick={handleRemoveAvatar}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Input
              label="Full Name"
              value={profileData.name}
              onChange={(e) => setProfileData((prev) => ({ ...prev, name: e.target.value }))}
              required
            />

            <Input
              label="Bio / Headline"
              type="textarea"
              rows={2}
              value={profileData.bio}
              onChange={(e) => setProfileData((prev) => ({ ...prev, bio: e.target.value }))}
              placeholder="Full-stack Engineer building open-source developer tools..."
            />

            <Input
              label="Skills & Technologies (comma separated)"
              value={profileData.skills}
              onChange={(e) => setProfileData((prev) => ({ ...prev, skills: e.target.value }))}
              placeholder="React, TypeScript, Go, Docker"
            />

            <Input
              label="GitHub URL"
              value={profileData.githubUrl}
              onChange={(e) => setProfileData((prev) => ({ ...prev, githubUrl: e.target.value }))}
              placeholder="https://github.com/username"
            />

            <Input
              label="Portfolio / Website URL"
              value={profileData.portfolioUrl}
              onChange={(e) => setProfileData((prev) => ({ ...prev, portfolioUrl: e.target.value }))}
              placeholder="https://developer.dev"
            />

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
              <input
                type="checkbox"
                id="jobSeekingCheck"
                checked={profileData.isJobSeeking}
                onChange={(e) => setProfileData((prev) => ({ ...prev, isJobSeeking: e.target.checked }))}
                style={{ width: "16px", height: "16px", accentColor: "var(--accent)" }}
              />
              <label htmlFor="jobSeekingCheck" style={{ fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                Feature profile as "Open to Work" on the Jobs board
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <Button type="submit" variant="primary" loading={profileSaving}>
                Save Profile
              </Button>
            </div>
          </form>
        </Card>

        {/* Password Update Card */}
        <Card style={{ padding: "20px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
            Security & Password
          </h2>

          {passwordSuccess && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                backgroundColor: "var(--success-bg)",
                border: "1px solid var(--success-border)",
                borderRadius: "var(--radius-btn)",
                color: "var(--success)",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              <Check size={16} />
              <span>Password updated successfully!</span>
            </div>
          )}

          {passwordError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                backgroundColor: "var(--danger-bg)",
                border: "1px solid var(--danger-border)",
                borderRadius: "var(--radius-btn)",
                color: "var(--danger)",
                fontSize: "13px",
                marginBottom: "14px",
              }}
            >
              <AlertCircle size={16} />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <Button type="submit" variant="secondary" loading={passwordSaving}>
                Update Password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import User from "../users/user.model.js";
import { env } from "../../config/env.js";
import { createUser } from "../users/user.controller.js";
import { sendPasswordResetEmail } from "../../services/mail/mail.service.js";

const createToken = (userId) => jwt.sign({}, env.jwtSecret, {
    subject: userId.toString(),
    expiresIn: "7d"
});

// Deliberately identical response for every input so the endpoint cannot be
// used to discover whether an email is registered.
const GENERIC_RESET_MESSAGE =
    "If an account exists for this email, a password reset link has been sent.";

const MIN_PASSWORD_LENGTH = 8;

const hashResetToken = (rawToken) =>
    crypto.createHash("sha256").update(rawToken).digest("hex");


export const login = async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required"
        });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({
            success: false,
            message: "Invalid email or password"
        });
    }

    const safeUser = user.toObject();
    delete safeUser.password;

    return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
            token: createToken(user._id),
            user: safeUser
        }
    });
};

export const register = createUser;

export const getMe = async (req, res) => {
    return res.status(200).json({ success: true, data: { user: req.user } });
};

export const updatePassword = async (req, res) => {
    const { currentPassword, password, newPassword } = req.body;
    const nextPassword = password || newPassword;

    if (!currentPassword || !nextPassword) {
        return res.status(400).json({ success: false, message: "Current and new passwords are required" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(nextPassword, 12);
    await user.save();
    return res.status(200).json({ success: true, message: "Password updated successfully" });
};

export const logout = async (_req, res) => {
    return res.status(200).json({ success: true, message: "Logged out successfully" });
};

// POST /api/v1/auth/forgot-password
// Always answers 200 with the same message: no account enumeration.
export const forgotPassword = async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
        return res.status(400).json({
            success: false,
            message: "Email is required"
        });
    }

    const user = await User.findOne({ email });

    if (user) {
        // Only the SHA-256 of the token is persisted; the raw token only ever
        // exists in the emailed link.
        const rawToken = crypto.randomBytes(32).toString("hex");
        const resetPasswordExpire = new Date(Date.now() + env.passwordResetTokenTtlMs);

        user.resetPasswordToken = hashResetToken(rawToken);
        user.resetPasswordExpire = resetPasswordExpire;
        await user.save();

        const resetUrl = `${env.clientUrl.replace(/\/$/, "")}/reset-password?token=${rawToken}`;
        const result = await sendPasswordResetEmail({
            to: user.email,
            name: user.name,
            resetUrl
        });

        if (!result.delivered && result.reason === "smtp_not_configured") {
            // Development convenience: no email provider configured, so log the
            // link instead of silently dropping it. Never logged in production.
            console.warn(
                `[auth] SMTP is not configured — password reset link for ${user.email}: ${resetUrl}`
            );
        }
    }

    return res.status(200).json({
        success: true,
        message: GENERIC_RESET_MESSAGE
    });
};

// POST /api/v1/auth/reset-password
export const resetPassword = async (req, res) => {
    const rawToken = req.body.token?.trim();
    const password = req.body.password;

    if (!rawToken) {
        return res.status(400).json({ success: false, message: "Reset token is required" });
    }

    if (!password || password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({
            success: false,
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
        });
    }

    if (req.body.confirmPassword !== undefined && req.body.confirmPassword !== password) {
        return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    const user = await User.findOne({
        resetPasswordToken: hashResetToken(rawToken)
    }).select("+password +resetPasswordToken +resetPasswordExpire");

    if (!user || !user.resetPasswordExpire) {
        return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    if (user.resetPasswordExpire.getTime() < Date.now()) {
        // Expire the token so it cannot be retried.
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    user.password = await bcrypt.hash(password, 12);
    // Invalidate the token immediately after use.
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return res.status(200).json({
        success: true,
        message: "Password reset successfully. You can now sign in."
    });
};

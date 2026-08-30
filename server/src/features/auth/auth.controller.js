import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../users/user.model.js";
import { env } from "../../config/env.js";

const createToken = (userId) => jwt.sign({}, env.jwtSecret, {
    subject: userId.toString(),
    expiresIn: "7d"
});

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

import jwt from "jsonwebtoken";

import User from "../features/users/user.model.js";
import { env } from "../config/env.js";

export const authenticate = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;

        if (!authorization?.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        const token = authorization.slice(7);
        const payload = jwt.verify(token, env.jwtSecret);
        const user = await User.findById(payload.sub).select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        req.user = user;
        return next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
};

export const optionalAuthenticate = async (req, res, next) => {
    try {
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith("Bearer ")) {
            return next();
        }

        const token = authorization.slice(7);
        const payload = jwt.verify(token, env.jwtSecret);
        const user = await User.findById(payload.sub).select("-password");
        if (user) {
            req.user = user;
        }
        return next();
    } catch {
        return next();
    }
};

export const requireOwner = (getOwnerId) => (req, res, next) => {
    const ownerId = getOwnerId(req);

    if (!ownerId || ownerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to modify this resource"
        });
    }

    return next();
};

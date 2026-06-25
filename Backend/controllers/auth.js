import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid"; // Run 'npm install uuid' inside src/
import { PutCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";
import { buildUserPayload } from "../utils/serializers.js";
import {
  checkSmsVerification,
  isVerifyConfigured,
  sendSmsVerification,
} from "../services/verifyService.js";

const router = express.Router();

// Helper: Find user by email using Scan
const findUserByEmail = async (email) => {
  const params = {
    TableName: TABLES.USERS,
    FilterExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": email.toLowerCase().trim(),
    },
  };

  const response = await dynamoDB.send(new ScanCommand(params));
  return response.Items && response.Items.length > 0 ? response.Items[0] : null;
};

const signToken = (user, secret) => {
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  // DynamoDB item uses plain strings, so sub uses user.id instead of user.id
  const payload = { sub: user.id, role: user.role };
  return jwt.sign(payload, secret, { expiresIn: "7d" });
};

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    // Replicating default schemas since we deleted User.js model
    const userItem = {
      id:id,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone,
      passwordHash,
      role: "customer",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notificationPrefs: {
        email: true,
        whatsapp: true,
        inApp: true,
        sms: false,
        push: true,
        bookingReminders: true,
        promotions: false,
        newsletter: true,
      },
      preferences: {
        theme: "light",
        favoriteServices: [],
      },
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: userItem,
      }),
    );

    // Adjust user item shape slightly so your frontend buildUserPayload serializer doesn't break
    const simulatedDoc = { ...userItem, id: id };
    const token = signToken(simulatedDoc, process.env.JWT_SECRET);

    res.status(201).json({
      user: buildUserPayload(simulatedDoc),
      token,
    });
  } catch (err) {
    console.error("Failed to register user", err);
    res.status(500).json({ message: "Failed to register user" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const simulatedDoc = { ...user, id: user.id };
    const token = signToken(simulatedDoc, process.env.JWT_SECRET);

    res.json({
      user: buildUserPayload(simulatedDoc),
      token,
    });
  } catch (err) {
    console.error("Failed to log in", err);
    res.status(500).json({ message: "Failed to login" });
  }
});

// FORGOT PASSWORD
router.post("/password/forgot", async (req, res) => {
  try {
    if (!isVerifyConfigured()) {
      return res
        .status(503)
        .json({ message: "Twilio Verify credentials are not configured" });
    }

    const { email, locale } = req.body ?? {};
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.phone) {
      return res.json({ message: "If the account exists, a code was sent" });
    }

    await sendSmsVerification({ to: user.phone, locale });
    res.json({ message: "Verification code sent" });
  } catch (err) {
    console.error("Failed to start password reset verification", err);
    const status = err?.status || err?.statusCode || 500;
    res
      .status(status)
      .json({ message: err.message || "Failed to send verification code" });
  }
});

// VERIFY PASSWORD RESET CODE
router.post("/password/verify", async (req, res) => {
  try {
    if (!isVerifyConfigured()) {
      return res
        .status(503)
        .json({ message: "Twilio Verify credentials are not configured" });
    }

    const { email, code } = req.body ?? {};
    if (!email || !code) {
      return res
        .status(400)
        .json({ message: "Email and verification code are required" });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.phone) {
      return res
        .status(400)
        .json({ message: "Unable to verify the provided credentials" });
    }

    const verification = await checkSmsVerification({ to: user.phone, code });
    if (!verification?.valid) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Use UpdateCommand to add reset tokens directly to the item
    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { id: user.id },
        UpdateExpression:
          "SET resetPasswordToken = :token, resetPasswordExpires = :expiry, updatedAt = :now",
        ExpressionAttributeValues: {
          ":token": hashedToken,
          ":expiry": expiresAt,
          ":now": new Date().toISOString(),
        },
      }),
    );

    res.json({
      message: "Verification successful",
      resetToken: rawToken,
      expiresAt,
    });
  } catch (err) {
    console.error("Failed to verify password reset code", err);
    const status = err?.status || err?.statusCode || 500;
    res
      .status(status)
      .json({ message: err.message || "Failed to verify the provided code" });
  }
});

// PASSWORD RESET EXECUTION
router.post("/password/reset", async (req, res) => {
  try {
    const { email, token, password } = req.body ?? {};

    if (!email || !token || !password) {
      return res
        .status(400)
        .json({
          message: "Email, verification token, and new password are required",
        });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });
    }

    const user = await findUserByEmail(email);
    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    if (new Date(user.resetPasswordExpires) < new Date()) {
      // Clear expired tokens
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.USERS,
          Key: { id: user.id },
          UpdateExpression:
            "REMOVE resetPasswordToken, resetPasswordExpires SET updatedAt = :now",
          ExpressionAttributeValues: { ":now": new Date().toISOString() },
        }),
      );
      return res
        .status(400)
        .json({ message: "Reset token has expired. Please try again." });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    if (hashedToken !== user.resetPasswordToken) {
      return res
        .status(400)
        .json({ message: "Invalid or expired reset token" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { id: user.id },
        UpdateExpression:
          "SET passwordHash = :hash REMOVE resetPasswordToken, resetPasswordExpires SET updatedAt = :now",
        ExpressionAttributeValues: {
          ":hash": passwordHash,
          ":now": new Date().toISOString(),
        },
      }),
    );

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Failed to reset password", err);
    res
      .status(500)
      .json({ message: err.message || "Failed to reset password" });
  }
});

export default router;

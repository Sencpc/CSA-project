import express from "express";
import {
  checkSmsVerification,
  isVerifyConfigured,
  sendSmsVerification,
} from "../services/verifyService.js";

const router = express.Router();

const normaliseDialCode = (code) => {
  if (!code && code !== 0) {
    return null;
  }
  const digits = String(code).replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }
  return digits;
};

const normalisePhone = (phone) => {
  if (!phone && phone !== 0) {
    return null;
  }
  const digits = String(phone).replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }
  return digits;
};

const buildE164 = ({ countryCode, phoneNumber }) => {
  const dial = normaliseDialCode(countryCode);
  const subscriber = normalisePhone(phoneNumber);
  if (!dial || !subscriber) {
    return null;
  }
  return `+${dial}${subscriber}`;
};

router.post("/send-otp", async (req, res) => {
  try {
    if (!isVerifyConfigured()) {
      return res
        .status(503)
        .json({ message: "Twilio Verify credentials are not configured" });
    }

    const { countryCode, phoneNumber, locale } = req.body ?? {};
    const destination = buildE164({ countryCode, phoneNumber });
    if (!destination) {
      return res.status(400).json({
        message: "A valid countryCode and phoneNumber are required",
      });
    }

    const verification = await sendSmsVerification({
      to: destination,
      locale,
    });

    res.status(200).json({
      message: "OTP sent successfully",
      verification,
    });
  } catch (error) {
    console.error("Failed to send OTP", error);
    const status = error?.status || error?.statusCode || 500;
    res.status(status).json({
      message: error?.message || "Failed to send OTP",
    });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    if (!isVerifyConfigured()) {
      return res
        .status(503)
        .json({ message: "Twilio Verify credentials are not configured" });
    }

    const { countryCode, phoneNumber, otp } = req.body ?? {};
    const destination = buildE164({ countryCode, phoneNumber });
    if (!destination || !otp) {
      return res.status(400).json({
        message: "countryCode, phoneNumber, and otp are required",
      });
    }

    const verification = await checkSmsVerification({
      to: destination,
      code: otp,
    });

    if (!verification?.valid) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    res.status(200).json({
      message: "OTP verified successfully",
      verification,
    });
  } catch (error) {
    console.error("Failed to verify OTP", error);
    const status = error?.status || error?.statusCode || 500;
    res.status(status).json({
      message: error?.message || "Failed to verify OTP",
    });
  }
});

export default router;

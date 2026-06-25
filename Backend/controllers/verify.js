import express from "express";
import {
  checkSmsVerification,
  ensureVerifyService,
  isVerifyConfigured,
  sendSmsVerification,
} from "../services/verifyService.js";

const router = express.Router();

router.post("/service", async (req, res) => {
  try {
    if (!isVerifyConfigured()) {
      return res
        .status(503)
        .json({ message: "Twilio Verify credentials are not configured" });
    }

    const serviceSid = await ensureVerifyService();
    res.status(201).json({ serviceSid });
  } catch (error) {
    console.error("Failed to create Twilio Verify service", error);
    res.status(500).json({ message: "Failed to create verify service" });
  }
});

router.post("/send", async (req, res) => {
  try {
    if (!isVerifyConfigured()) {
      return res
        .status(503)
        .json({ message: "Twilio Verify credentials are not configured" });
    }

    const { phone, locale } = req.body ?? {};
    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    const verification = await sendSmsVerification({ to: phone, locale });
    res.status(201).json({ verification });
  } catch (error) {
    console.error("Failed to start SMS verification", error);
    const status = error?.status || error?.statusCode;
    if (status) {
      return res.status(status).json({ message: error.message });
    }
    res
      .status(500)
      .json({ message: error.message || "Failed to start verification" });
  }
});

router.post("/check", async (req, res) => {
  try {
    if (!isVerifyConfigured()) {
      return res
        .status(503)
        .json({ message: "Twilio Verify credentials are not configured" });
    }

    const { phone, code } = req.body ?? {};
    if (!phone || !code) {
      return res
        .status(400)
        .json({ message: "Phone number and code are required" });
    }

    const verification = await checkSmsVerification({ to: phone, code });
    res.json({ verification });
  } catch (error) {
    console.error("Failed to verify SMS code", error);
    const status = error?.status || error?.statusCode;
    if (status) {
      return res.status(status).json({ message: error.message });
    }
    res.status(500).json({ message: error.message || "Verification failed" });
  }
});

export default router;

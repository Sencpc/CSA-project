/* eslint-env node */
import dotenv from "dotenv";
import {
  ensureVerifyService,
  isVerifyConfigured,
} from "../services/verifyService.js";

dotenv.config();

const run = async () => {
  if (!isVerifyConfigured()) {
    throw new Error(
      "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set before creating a verify service"
    );
  }

  const sid = await ensureVerifyService();

  console.log("Verify service ready");
  console.log("SID:", sid);
  console.log(
    "Store this SID for reference if needed. The application will reuse it automatically based on the friendly name."
  );
};

run()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to create Twilio Verify service", error);
    process.exit(1);
  });

import twilio from "twilio";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_FRIENDLY_NAME,
  TWILIO_VERIFY_SERVICE_SID,
} = process.env;

const DEFAULT_FRIENDLY_NAME =
  TWILIO_VERIFY_FRIENDLY_NAME || "Flower Beauty Salon Authentication";

let cachedClient;
let cachedServiceSid = null;

const ensureClient = () => {
  if (!cachedClient) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials are not configured");
    }
    cachedClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return cachedClient;
};

const normaliseToE164 = (input) => {
  if (!input) {
    return null;
  }
  const trimmed = String(input).replace(/[^+\d]/g, "");
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  if (trimmed.startsWith("00")) {
    return `+${trimmed.slice(2)}`;
  }
  return `+${trimmed}`;
};

export const isVerifyConfigured = () =>
  Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);

export const ensureVerifyService = async () => {
  const client = ensureClient();
  if (cachedServiceSid) {
    return cachedServiceSid;
  }

  if (TWILIO_VERIFY_SERVICE_SID) {
    cachedServiceSid = TWILIO_VERIFY_SERVICE_SID;
    return cachedServiceSid;
  }

  const services = await client.verify.v2.services.list({ limit: 20 });
  const existing = services.find((service) => {
    if (service.friendlyName === DEFAULT_FRIENDLY_NAME) {
      return true;
    }
    return (
      service.friendlyName &&
      service.friendlyName.toLowerCase() === DEFAULT_FRIENDLY_NAME.toLowerCase()
    );
  });

  if (existing) {
    cachedServiceSid = existing.sid;
    return cachedServiceSid;
  }

  const service = await client.verify.v2.services.create({
    friendlyName: DEFAULT_FRIENDLY_NAME,
  });

  cachedServiceSid = service.sid;
  return cachedServiceSid;
};

export const sendSmsVerification = async ({ to, locale }) => {
  const recipient = normaliseToE164(to);
  if (!recipient) {
    const error = new Error("A valid destination phone number is required");
    error.status = 400;
    throw error;
  }

  const client = ensureClient();
  const serviceSid = await ensureVerifyService();

  const payload = {
    channel: "sms",
    to: recipient,
  };

  if (locale) {
    payload.locale = locale;
  }

  const verification = await client.verify.v2
    .services(serviceSid)
    .verifications.create(payload);

  return {
    sid: verification.sid,
    status: verification.status,
    to: verification.to,
    channel: verification.channel,
    serviceSid,
  };
};

export const checkSmsVerification = async ({ to, code }) => {
  const recipient = normaliseToE164(to);
  if (!recipient) {
    const error = new Error("A valid destination phone number is required");
    error.status = 400;
    throw error;
  }
  if (!code || String(code).trim().length === 0) {
    const error = new Error("A verification code is required");
    error.status = 400;
    throw error;
  }

  const client = ensureClient();
  const serviceSid = await ensureVerifyService();

  const verificationCheck = await client.verify.v2
    .services(serviceSid)
    .verificationChecks.create({
      to: recipient,
      code: String(code).trim(),
    });

  return {
    sid: verificationCheck.sid,
    status: verificationCheck.status,
    to: verificationCheck.to,
    valid: verificationCheck.status === "approved",
    serviceSid,
  };
};

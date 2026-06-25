import twilio from "twilio";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  WHATSAPP_TEST_MODE,
} = process.env;

let twilioClient;

const resolveFromNumber = () => {
  if (!TWILIO_PHONE_NUMBER) {
    return null;
  }

  return TWILIO_PHONE_NUMBER.startsWith("whatsapp:")
    ? TWILIO_PHONE_NUMBER
    : `whatsapp:${TWILIO_PHONE_NUMBER}`;
};

const toE164 = (phone) => {
  if (!phone) return null;
  const trimmed = phone.replace(/[^+\d]/g, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  if (trimmed.startsWith("00")) {
    return `+${trimmed.slice(2)}`;
  }
  return `+${trimmed}`;
};

const toWhatsAppAddress = (phone) => {
  if (!phone) return null;
  const normalised = phone.startsWith("whatsapp:")
    ? phone.replace(/^whatsapp:/, "")
    : phone;
  const e164 = toE164(normalised);
  if (!e164) return null;
  return `whatsapp:${e164}`;
};

export const isWhatsAppConfigured = () =>
  Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && resolveFromNumber());

const getClient = () => {
  if (!twilioClient) {
    if (!isWhatsAppConfigured()) {
      throw new Error("Twilio WhatsApp credentials are not configured");
    }
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
};

export const sendWhatsAppMessage = async ({
  to,
  body,
  mediaUrl,
  statusCallback,
}) => {
  const from = resolveFromNumber();
  const recipient = toWhatsAppAddress(to);

  if (!from || !recipient) {
    throw new Error("Unable to resolve WhatsApp sender or recipient");
  }

  if (WHATSAPP_TEST_MODE === "true") {
    console.info("[WhatsApp:test]", { to: recipient, body, mediaUrl });
    return {
      sid: "test-message",
      to: recipient,
      from,
      body,
      status: "queued",
      testMode: true,
      dateCreated: new Date().toISOString(),
    };
  }

  const client = getClient();

  const payload = {
    from,
    to: recipient,
    body,
  };

  if (Array.isArray(mediaUrl) && mediaUrl.length > 0) {
    payload.mediaUrl = mediaUrl;
  }

  if (statusCallback) {
    payload.statusCallback = statusCallback;
  }

  const message = await client.messages.create(payload);
  return message;
};

export const sendWhatsAppTemplate = async ({ to, template, components }) => {
  if (!template) {
    throw new Error("Template name is required");
  }

  const from = resolveFromNumber();
  const recipient = toWhatsAppAddress(to);

  if (!from || !recipient) {
    throw new Error("Unable to resolve WhatsApp sender or recipient");
  }

  if (WHATSAPP_TEST_MODE === "true") {
    console.info("[WhatsApp:test-template]", {
      to: recipient,
      template,
      components,
    });
    return {
      sid: "test-template",
      to: recipient,
      from,
      template,
      components,
      status: "queued",
      testMode: true,
      dateCreated: new Date().toISOString(),
    };
  }

  const client = getClient();

  return client.messages.create({
    from,
    to: recipient,
    contentSid: template,
    contentVariables: components ? JSON.stringify(components) : undefined,
  });
};

export const formatCustomerWhatsApp = (user) => {
  if (!user) return null;
  if (typeof user === "string") {
    return toWhatsAppAddress(user);
  }
  const phone = user.phone || user.whatsapp || user.contact;
  return toWhatsAppAddress(phone ?? null);
};

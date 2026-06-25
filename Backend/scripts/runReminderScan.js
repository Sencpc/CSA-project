import "dotenv/config";

process.env.TWILIO_ACCOUNT_SID ||= "test-account";
process.env.TWILIO_AUTH_TOKEN ||= "test-token";
process.env.TWILIO_PHONE_NUMBER ||= "+12294082845";
process.env.WHATSAPP_TEST_MODE = "true";

// Import job scanner pengingat yang sudah kita migrasikan ke DynamoDB tempo hari
const { runBookingReminderScan } =
  await import("../jobs/bookingReminderJob.js");

const main = async () => {
  console.log("Memulai pencarian data booking H+3 di DynamoDB...");
  const result = await runBookingReminderScan();
  console.info("Hasil Pemindaian Klien WA:", JSON.stringify(result, null, 2));
  process.exit(0);
};

main().catch((error) => {
  console.error("Pemindaian gagal:", error);
  process.exit(1);
});

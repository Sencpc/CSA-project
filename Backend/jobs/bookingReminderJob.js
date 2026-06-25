import cron from "node-cron";
import dayjs from "dayjs";
import { ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";
import {
  formatCustomerWhatsApp,
  isWhatsAppConfigured,
  sendWhatsAppMessage,
} from "../services/whatsappService.js";

const REMINDER_CRON = process.env.BOOKING_REMINDER_CRON || "0 9 * * *";
const REMINDER_TIMEZONE = process.env.BOOKING_REMINDER_TZ || "Asia/Jakarta";
const REMINDER_STATUS_ALLOWLIST = ["confirmed", "in-progress"];

const formatServiceList = (services) => {
  if (!Array.isArray(services) || services.length === 0) {
    return "your upcoming appointment";
  }
  if (services.length === 1) {
    return services[0].name || "your service";
  }
  const names = services.map((service) => service?.name).filter(Boolean);
  if (names.length === 0) {
    return "your upcoming appointment";
  }
  if (names.length === 1) {
    return names[0];
  }
  const last = names.pop();
  return `${names.join(", ")}, and ${last}`;
};

const buildReminderMessage = (booking) => {
  const customerName = booking?.user?.fullName || "there";
  const start = dayjs(booking.startTime);
  const formattedDate = start.format("dddd, DD MMM YYYY");
  const formattedTime = start.format("HH:mm");
  const services = formatServiceList(booking.services);

  return (
    `Halo ${customerName}! Ini pengingat bahwa ${services} ` +
    `dijadwalkan pada ${formattedDate} pukul ${formattedTime}. ` +
    "Jika Anda perlu melakukan perubahan, hubungi kami segera. Sampai jumpa!"
  );
};

export const runBookingReminderScan = async () => {
  if (!isWhatsAppConfigured()) {
    console.warn("WhatsApp reminder skipped: credentials not configured");
    return { ran: false, reason: "unconfigured" };
  }

  const now = dayjs();
  const targetStart = now.add(3, "day").startOf("day");
  const targetEnd = targetStart.endOf("day");

  // 1. Fetch raw bookings and users via full table scans
  const [bookingsRes, usersRes] = await Promise.all([
    dynamoDB.send(new ScanCommand({ TableName: TABLES.BOOKINGS })),
    dynamoDB.send(new ScanCommand({ TableName: TABLES.USERS })),
  ]);

  const allBookings = bookingsRes.Items || [];
  const allUsers = usersRes.Items || [];

  // 2. Perform advanced filtration logic in-memory (replacing Mongoose MongoDB queries)
  let targetBookings = allBookings.filter((booking) => {
    // Check status allowlist
    if (!REMINDER_STATUS_ALLOWLIST.includes(booking.status)) return false;

    // Check startTime window bounds
    if (!booking.startTime) return false;
    const bTime = dayjs(booking.startTime);
    if (bTime.isBefore(targetStart) || bTime.isAfter(targetEnd)) return false;

    // Emulate $exists or null verification checks for past reminders
    if (booking.reminders?.threeDay?.sentAt) return false;

    return true;
  });

  if (targetBookings.length === 0) {
    return { ran: true, processed: 0 };
  }

  // 3. Hydrate/Populate user info nodes onto the booking array blocks manually
  targetBookings = targetBookings.map((booking) => {
    const matchedUser = allUsers.find((u) => u.id === booking.user);
    return {
      ...booking,
      id: booking.bookingId, // Retain standard property parsing pointers for internal subroutines
      user: matchedUser || null,
    };
  });

  let processed = 0;
  const failures = [];

  for (const booking of targetBookings) {
    if (!booking.user) {
      failures.push({
        bookingId: booking.bookingId,
        reason: "missing_hydrated_user_profile",
      });
      continue;
    }

    const to = formatCustomerWhatsApp(booking.user);
    if (!to) {
      failures.push({
        bookingId: booking.bookingId,
        reason: "missing_whatsapp_number",
      });
      continue;
    }

    try {
      const message = await sendWhatsAppMessage({
        to,
        body: buildReminderMessage(booking),
      });

      // Initialize reminders object maps if undefined on source schemaless row
      const freshReminders = booking.reminders || {};
      freshReminders.threeDay = {
        sentAt: new Date().toISOString(),
        messageSid: message?.sid ?? null,
      };

      // 4. Update reminder metadata fields via UpdateCommand
      await dynamoDB.send(
        new UpdateCommand({
          TableName: TABLES.BOOKINGS,
          Key: { bookingId: booking.bookingId },
          UpdateExpression: "SET reminders = :rem",
          ExpressionAttributeValues: { ":rem": freshReminders },
        }),
      );

      processed += 1;
    } catch (error) {
      console.error("Failed to send booking reminder", {
        bookingId: booking.bookingId,
        error: error.message,
      });
      failures.push({
        bookingId: booking.bookingId,
        reason: error.message,
      });
    }
  }

  return { ran: true, processed, failures };
};

let cronJob;

export const startBookingReminderJob = () => {
  if (cronJob) {
    return cronJob;
  }

  cronJob = cron.schedule(
    REMINDER_CRON,
    () => {
      runBookingReminderScan().catch((error) => {
        console.error("Booking reminder job failed", error);
      });
    },
    {
      timezone: REMINDER_TIMEZONE,
    },
  );

  console.info(
    `Booking reminder job scheduled with cron "${REMINDER_CRON}" (${REMINDER_TIMEZONE})`,
  );

  return cronJob;
};

export const stopBookingReminderJob = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
};

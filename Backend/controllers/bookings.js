import express from "express";
import { GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  buildBookingPayload,
  buildBookingsResponse,
  buildBookingStats,
} from "../utils/serializers.js";

const router = express.Router();

const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "in-progress",
  "completed",
  "cancelled",
];

const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "refunded"];

const optionalString = (value) =>
  typeof value === "string" ? value.trim() || null : null;

router.use(authenticate);
router.use(authorizeRoles("admin"));

// Helper: Simulate Mongoose populate for Bookings in memory
const populateBookingsMemory = async (rawBookings) => {
  if (!rawBookings.length) return [];

  // Fetch all users to map both customer profile attributes and stylist profile data
  const usersRes = await dynamoDB.send(
    new ScanCommand({ TableName: TABLES.USERS }),
  );
  const users = usersRes.Items || [];

  return rawBookings.map((b) => {
    const customerMatch = users.find((u) => u.id === b.user);
    const stylistMatch = users.find((u) => u.id === b.stylist);

    return {
      ...b,
      id: b.bookingId, // Maintain serializer model compatibility
      user: customerMatch
        ? { ...customerMatch, id: customerMatch.id }
        : null,
      stylist: stylistMatch
        ? { ...stylistMatch, id: stylistMatch.id }
        : null,
    };
  });
};

// GET ALL BOOKINGS (WITH DASHBOARD LIST SCANS)
router.get("/", async (req, res) => {
  try {
    const { status, paymentStatus, dateFrom, dateTo } = req.query;

    const response = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.BOOKINGS }),
    );
    let records = response.Items || [];

    // In-Memory Filtration
    if (status && BOOKING_STATUSES.includes(status)) {
      records = records.filter((b) => b.status === status);
    }

    if (paymentStatus && PAYMENT_STATUSES.includes(paymentStatus)) {
      records = records.filter((b) => b.payment?.status === paymentStatus);
    }

    if (dateFrom || dateTo) {
      records = records.filter((b) => {
        const slotDate = b.slot?.date;
        if (!slotDate) return false;
        if (dateFrom && slotDate < dateFrom) return false;
        if (dateTo && slotDate > dateTo) return false;
        return true;
      });
    }

    // Populate user and stylist nodes
    let populated = await populateBookingsMemory(records);

    // Sort by createdAt desc
    populated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      bookings: buildBookingsResponse(populated),
      stats: buildBookingStats(populated),
    });
  } catch (error) {
    console.error("Failed to fetch bookings", error);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
});

// ACCEPT BOOKING
router.post("/:id/accept", async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.BOOKINGS,
        Key: { bookingId: id },
      }),
    );

    if (!existing.Item) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = existing.Item;

    if (booking.status === "cancelled") {
      return res
        .status(409)
        .json({ message: "Booking already cancelled and cannot be accepted" });
    }
    if (["confirmed", "in-progress", "completed"].includes(booking.status)) {
      return res.status(409).json({ message: "Booking is already processed" });
    }

    const { stylistId, adminNotes } = req.body ?? {};
    let updateExpressions = ["SET #bStatus = :status, updatedAt = :now"];
    let expressionAttributeValues = {
      ":status": "confirmed",
      ":now": new Date().toISOString(),
    };
    let expressionAttributeNames = { "#bStatus": "status" }; // status is an AWS reserved keyword

    if (stylistId) {
      const stylistCheck = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.USERS,
          Key: { id: stylistId },
        }),
      );
      if (!stylistCheck.Item) {
        return res.status(404).json({ message: "Stylist not found" });
      }
      updateExpressions.push("stylist = :stylistId");
      expressionAttributeValues[":stylistId"] = stylistId;
    }

    if (adminNotes !== undefined) {
      updateExpressions.push("adminNotes = :adminNotes");
      expressionAttributeValues[":adminNotes"] = optionalString(adminNotes);
    }

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.BOOKINGS,
        Key: { bookingId: id },
        UpdateExpression: updateExpressions.join(", "),
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      }),
    );

    const freshRes = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.BOOKINGS, Key: { bookingId: id } }),
    );
    const populatedArray = await populateBookingsMemory([freshRes.Item]);

    res.json({ booking: buildBookingPayload(populatedArray[0]) });
  } catch (error) {
    console.error("Failed to accept booking", error);
    res.status(500).json({ message: "Failed to accept booking" });
  }
});

// CANCEL BOOKING
router.post("/:id/cancel", async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.BOOKINGS,
        Key: { bookingId: id },
      }),
    );

    if (!existing.Item) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const booking = existing.Item;

    if (["cancelled", "completed"].includes(booking.status)) {
      return res.status(409).json({ message: "Booking cannot be cancelled" });
    }

    const { adminNotes, paymentStatus } = req.body ?? {};
    let updateExpressions = ["SET #bStatus = :status, updatedAt = :now"];
    let expressionAttributeValues = {
      ":status": "cancelled",
      ":now": new Date().toISOString(),
    };
    let expressionAttributeNames = { "#bStatus": "status" };

    if (adminNotes !== undefined) {
      updateExpressions.push("adminNotes = :adminNotes");
      expressionAttributeValues[":adminNotes"] = optionalString(adminNotes);
    }

    if (booking.payment) {
      let freshPayment = { ...booking.payment };
      if (paymentStatus) {
        if (!PAYMENT_STATUSES.includes(paymentStatus)) {
          return res.status(400).json({ message: "Invalid payment status" });
        }
        freshPayment.status = paymentStatus;
      } else if (booking.payment.status === "paid") {
        freshPayment.status = "refunded";
      }
      updateExpressions.push("payment = :payment");
      expressionAttributeValues[":payment"] = freshPayment;
    }

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.BOOKINGS,
        Key: { bookingId: id },
        UpdateExpression: updateExpressions.join(", "),
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
      }),
    );

    const freshRes = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.BOOKINGS, Key: { bookingId: id } }),
    );
    const populatedArray = await populateBookingsMemory([freshRes.Item]);

    res.json({ booking: buildBookingPayload(populatedArray[0]) });
  } catch (error) {
    console.error("Failed to cancel booking", error);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
});

export default router;

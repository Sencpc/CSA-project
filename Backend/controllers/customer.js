import express from "express";
import bcrypt from "bcryptjs";
import midtransClient from "midtrans-client";
import { v4 as uuidv4 } from "uuid";
import { randomUUID } from "node:crypto";
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  buildBookingPayload,
  buildBookingsResponse,
  buildServicesResponse,
  buildUserPayload,
  buildCouponPayload,
} from "../utils/serializers.js";

// 1. ADD THIS RIGHT HERE AT THE TOP OF CUSTOMER.JS
const router = express.Router();

// 2. YOUR VARIABLES STAY DIRECTLY BELOW IT
const WORK_START_MINUTE = 8 * 60; // 08:00
const WORK_END_MINUTE = 17 * 60; // 17:00
const WORK_MINUTES_PER_STAFF = WORK_END_MINUTE - WORK_START_MINUTE;
const MINUTE_STEP = 15;
const SLOT_INCREMENT_MINUTES = 30;

const CLOSED_DAY_INDEX = 1; // Monday closed (0 = Sunday)

const parseMonthParam = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const [yearStr, monthStr] = trimmed.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 0 || month > 11) return null;
  return new Date(year, month, 1);
};

const toDateKey = (dateLike) => {
  if (!dateLike) return null;
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

const clampToWorkday = (minutes) => {
  if (!Number.isFinite(minutes)) return null;
  if (minutes < WORK_START_MINUTE) return WORK_START_MINUTE;
  if (minutes > WORK_END_MINUTE) return WORK_END_MINUTE;
  return minutes;
};

const minutesFromDate = (dateLike) => {
  if (!dateLike) return null;
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
};

const buildTimeline = (bookings) => {
  const totalSteps = Math.ceil(
    (WORK_END_MINUTE - WORK_START_MINUTE) / MINUTE_STEP,
  );
  const timeline = Array(totalSteps).fill(0);

  bookings.forEach(({ startMinutes, endMinutes }) => {
    const clampedStart = clampToWorkday(startMinutes);
    const clampedEnd = clampToWorkday(endMinutes);
    if (clampedStart === null || clampedEnd === null) return;
    if (clampedEnd <= clampedStart) return;

    const startIndex = Math.max(
      0,
      Math.floor((clampedStart - WORK_START_MINUTE) / MINUTE_STEP),
    );
    const endIndex = Math.min(
      totalSteps,
      Math.ceil((clampedEnd - WORK_START_MINUTE) / MINUTE_STEP),
    );

    for (let index = startIndex; index < endIndex; index += 1) {
      timeline[index] += 1;
    }
  });
  return timeline;
};

const formatTimeLabel = (startMinutes, endMinutes) => {
  const pad = (value) => value.toString().padStart(2, "0");
  const startHours = Math.floor(startMinutes / 60);
  const startMins = startMinutes % 60;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  return `${pad(startHours)}:${pad(startMins)} - ${pad(endHours)}:${pad(endMins)}`;
};

const formatTimePoint = (minutes) => {
  const pad = (value) => value.toString().padStart(2, "0");
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${pad(hours)}:${pad(mins)}`;
};

const buildSlotOptions = ({ timeline, slotDuration, staffCount }) => {
  if (!timeline.length || staffCount <= 0) return [];
  const safeSlotDuration = Math.max(slotDuration, MINUTE_STEP);
  const slotSteps = Math.ceil(safeSlotDuration / MINUTE_STEP);
  const incrementSteps = Math.max(
    1,
    Math.ceil(SLOT_INCREMENT_MINUTES / MINUTE_STEP),
  );
  const totalSteps = timeline.length;

  const options = [];
  for (
    let startStep = 0;
    startStep + slotSteps <= totalSteps;
    startStep += incrementSteps
  ) {
    let maxOccupancy = 0;
    for (let idx = startStep; idx < startStep + slotSteps; idx += 1) {
      maxOccupancy = Math.max(maxOccupancy, timeline[idx]);
    }

    const remainingCapacity = Math.max(staffCount - maxOccupancy, 0);
    const startMinutes = WORK_START_MINUTE + startStep * MINUTE_STEP;
    const endMinutes =
      WORK_START_MINUTE + (startStep + slotSteps) * MINUTE_STEP;

    options.push({
      startMinutes,
      endMinutes,
      available: remainingCapacity > 0,
      remainingCapacity,
      label: formatTimeLabel(startMinutes, endMinutes),
    });
  }
  return options;
};

const createHttpError = (status, message) => {
  const error = new Error(message || "Unexpected error");
  error.status = status;
  return error;
};

const normalizeCouponCode = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
};

const normaliseAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(Math.round(numeric), 0) : 0;
};

const normaliseSignedAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
};

const normaliseCartService = (service) => {
  if (!service || typeof service !== "object") return null;
  const serviceIdRaw =
    service.serviceId ??
    service.id ??
    service.id ??
    service.slug ??
    service.name ??
    null;
  return {
    serviceId: serviceIdRaw ? serviceIdRaw.toString() : null,
    name:
      typeof service.name === "string" && service.name.trim()
        ? service.name.trim()
        : "Service",
    price: normaliseAmount(service.price ?? service.priceMin ?? 0),
    durationMinutes: Number.isFinite(Number(service.durationMinutes))
      ? Math.max(Math.round(Number(service.durationMinutes)), 0)
      : 0,
  };
};

const normaliseSchedule = (schedule) => {
  if (!schedule || typeof schedule !== "object") return null;
  return {
    date:
      typeof schedule.date === "string" && schedule.date.trim()
        ? schedule.date.trim()
        : null,
    startMinutes: Number.isFinite(Number(schedule.startMinutes))
      ? Math.round(Number(schedule.startMinutes))
      : null,
    endMinutes: Number.isFinite(Number(schedule.endMinutes))
      ? Math.round(Number(schedule.endMinutes))
      : null,
    startTime:
      typeof schedule.startTime === "string" ? schedule.startTime : null,
    endTime: typeof schedule.endTime === "string" ? schedule.endTime : null,
    label: typeof schedule.label === "string" ? schedule.label : null,
  };
};

const normaliseCartItem = (item) => {
  if (!item || typeof item !== "object") return null;
  const cartMain = normaliseCartService(item.cartMain);
  const cartExtras = Array.isArray(item.cartExtras)
    ? item.cartExtras.map(normaliseCartService).filter(Boolean)
    : [];

  const derivedTotal = normaliseAmount(
    (cartMain?.price ?? 0) + cartExtras.reduce((acc, x) => acc + x.price, 0),
  );
  const price =
    normaliseAmount(item.price) > 0
      ? normaliseAmount(item.price)
      : derivedTotal;

  const derivedDuration =
    (cartMain?.durationMinutes ?? 0) +
    cartExtras.reduce((acc, x) => acc + x.durationMinutes, 0);
  const durationMinutes =
    Number.isFinite(Number(item.durationMinutes)) &&
    Number(item.durationMinutes) > 0
      ? Math.round(Number(item.durationMinutes))
      : derivedDuration;

  const entryIdRaw =
    item.entryId ??
    item.serviceId ??
    item.id ??
    cartMain?.serviceId ??
    item.name ??
    null;

  return {
    entryId: entryIdRaw ? entryIdRaw.toString() : null,
    name:
      typeof item.name === "string" && item.name.trim()
        ? item.name.trim()
        : "Paket Layanan",
    price,
    durationMinutes,
    cartMain,
    cartExtras,
    schedule: normaliseSchedule(item.schedule),
  };
};

const normaliseCartItems = (items) =>
  Array.isArray(items) ? items.map(normaliseCartItem).filter(Boolean) : [];

const computeCartTotals = (items) => {
  let subtotal = 0;
  let totalDuration = 0;
  items.forEach((item) => {
    subtotal += item.price;
    totalDuration += item.durationMinutes;
  });
  return {
    subtotal: normaliseAmount(subtotal),
    totalDuration: Math.max(Math.round(totalDuration), 0),
  };
};

const collectCartServiceIds = (items) => {
  const ids = new Set();
  items.forEach((item) => {
    if (item?.cartMain?.serviceId) ids.add(item.cartMain.serviceId.toString());
    item?.cartExtras?.forEach((x) => {
      if (x?.serviceId) ids.add(x.serviceId.toString());
    });
  });
  return ids;
};

const ensureCouponRules = async (coupon, cartItems, subtotal) => {
  if (!coupon || typeof coupon !== "object")
    throw createHttpError(400, "Kupon tidak valid");
  const now = new Date();
  if (!coupon.isActive) throw createHttpError(400, "Kupon tidak aktif");
  if (coupon.startDate && new Date(coupon.startDate) > now)
    throw createHttpError(400, "Kupon belum dapat digunakan");
  if (coupon.endDate && new Date(coupon.endDate) < now)
    throw createHttpError(400, "Kupon telah kedaluwarsa");

  if (
    coupon.usageLimit !== null &&
    (Number(coupon.usedCount) || 0) >= Number(coupon.usageLimit)
  ) {
    throw createHttpError(400, "Kupon telah mencapai batas penggunaan");
  }

  if (Number(coupon.minSpend) > 0 && subtotal < Number(coupon.minSpend)) {
    throw createHttpError(
      400,
      `Minimum transaksi untuk kupon ini adalah Rp ${Number(coupon.minSpend).toLocaleString("id-ID")}`,
    );
  }

  const serviceIdsInCart = Array.from(collectCartServiceIds(cartItems));

  if (Array.isArray(coupon.serviceIds) && coupon.serviceIds.length > 0) {
    const allowedServiceIds = coupon.serviceIds.map(String);
    const hasMatch = serviceIdsInCart.some((id) =>
      allowedServiceIds.includes(id),
    );
    if (!hasMatch)
      throw createHttpError(
        400,
        "Kupon tidak berlaku untuk layanan yang dipilih",
      );
  }

  if (Array.isArray(coupon.categoryIds) && coupon.categoryIds.length > 0) {
    if (!serviceIdsInCart.length)
      throw createHttpError(400, "Kupon tidak dapat diterapkan");
    const categoryIds = coupon.categoryIds.map(String);

    // Fetch related services manually from scanning/batch processing inside DynamoDB
    const servicesRes = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.SERVICES }),
    );
    const relatedServices = (servicesRes.Items || []).filter((s) =>
      serviceIdsInCart.includes(s.serviceId),
    );

    const hasCategoryMatch = relatedServices.some((service) => {
      return service.categoryId
        ? categoryIds.includes(service.categoryId.toString())
        : false;
    });

    if (!hasCategoryMatch)
      throw createHttpError(
        400,
        "Kupon tidak berlaku untuk kategori layanan yang dipilih",
      );
  }
};

const computeDiscountAmount = (coupon, subtotal) => {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.discountType === "percent") {
    const percent = Number(coupon.amount);
    if (!Number.isFinite(percent) || percent <= 0) return 0;
    return Math.min(
      normaliseAmount((percent / 100) * subtotal),
      normaliseAmount(subtotal),
    );
  }
  return Math.min(normaliseAmount(coupon.amount), normaliseAmount(subtotal));
};

const buildCartPricingSummary = async ({
  items,
  couponCode,
  requireCoupon = false,
}) => {
  const cartItems = normaliseCartItems(items);
  if (!cartItems.length) throw createHttpError(400, "Keranjang masih kosong");

  const { subtotal, totalDuration } = computeCartTotals(cartItems);
  if (subtotal <= 0) throw createHttpError(400, "Total transaksi belum valid");

  const normalisedCode = normalizeCouponCode(couponCode);
  let coupon = null;
  let discountAmount = 0;

  if (normalisedCode) {
    const couponRes = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.COUPONS,
        Key: { code: normalisedCode },
      }),
    );
    coupon = couponRes.Item;
    if (!coupon) throw createHttpError(404, "Kupon tidak ditemukan");
    await ensureCouponRules(coupon, cartItems, subtotal);
    discountAmount = computeDiscountAmount(coupon, subtotal);
  } else if (requireCoupon) {
    throw createHttpError(400, "Kode kupon wajib diisi");
  }

  return {
    items: cartItems,
    subtotal,
    totalDuration,
    coupon,
    discountAmount,
    total: Math.max(subtotal - discountAmount, 0),
  };
};

let snapClientInstance = null;
const getSnapClient = () => {
  if (snapClientInstance) return snapClientInstance;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw createHttpError(500, "Midtrans belum dikonfigurasi");
  snapClientInstance = new midtransClient.Snap({
    isProduction:
      (process.env.MIDTRANS_IS_PRODUCTION || "").toLowerCase() === "true",
    serverKey,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  });
  return snapClientInstance;
};

const buildOrderId = (id) => {
  const userSegment = id
    ? id.toString().slice(-6).toUpperCase()
    : "CUST";
  const timestampSegment = Date.now().toString().slice(-10);
  const randomSegment = randomUUID()
    .replace(/-/g, "")
    .slice(0, 10)
    .toUpperCase();
  return `ORD-${userSegment}-${timestampSegment}-${randomSegment}`.slice(0, 50);
};

const getAppBaseUrl = (req) => {
  const candidate =
    process.env.APP_BASE_URL ||
    process.env.FRONTEND_BASE_URL ||
    req?.headers?.origin ||
    req?.headers?.referer;
  if (!candidate || typeof candidate !== "string") return null;
  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
};

const buildAppUrl = (req, path) => {
  const base = getAppBaseUrl(req);
  if (!base) return null;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

const buildSnapCallbacks = (req) => {
  const callbacks = {
    finish: buildAppUrl(req, "/customer/history?payment=success"),
    pending: buildAppUrl(req, "/customer/history?payment=pending"),
    error: buildAppUrl(req, "/customer/cart?payment=error"),
  };
  Object.keys(callbacks).forEach((key) => {
    if (!callbacks[key]) delete callbacks[key];
  });
  return callbacks;
};

const parseClockToMinutes = (value) => {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const resolveScheduleFromCart = (cartItems, totalDurationMinutes) => {
  const candidate = cartItems.find((item) => item?.schedule?.date) || null;
  const date = candidate?.schedule?.date || toDateKey(new Date());
  const scheduleMinutes =
    candidate?.schedule?.startMinutes ??
    parseClockToMinutes(candidate?.schedule?.startTime);
  const startMinutes = Number.isFinite(scheduleMinutes)
    ? Math.max(0, Math.round(scheduleMinutes))
    : WORK_START_MINUTE;
  const duration = Number.isFinite(totalDurationMinutes)
    ? Math.max(0, Math.round(totalDurationMinutes))
    : 0;

  const base = new Date(`${date}T00:00:00Z`);
  const startTime = new Date(
    base.getTime() + startMinutes * 60 * 1000,
  ).toISOString();
  const endTime = new Date(
    new Date(startTime).getTime() + duration * 60 * 1000,
  ).toISOString();

  return {
    date,
    startMinutes,
    endMinutes: startMinutes + duration,
    startTime,
    endTime,
  };
};

const buildBookedServicesFromCart = (cartItems) => {
  const services = [];
  cartItems.forEach((item) => {
    if (item.cartMain) {
      services.push({
        serviceId: item.cartMain.serviceId || null,
        name: item.cartMain.name,
        price: item.cartMain.price,
        durationMinutes: item.cartMain.durationMinutes,
      });
    }
    item.cartExtras.forEach((extra) => {
      services.push({
        serviceId: extra.serviceId || null,
        name: extra.name,
        price: extra.price,
        durationMinutes: extra.durationMinutes,
      });
    });
  });
  return services;
};

const normaliseMidtransStatus = (status) => {
  if (!status) return "pending";
  const lowered = status.toString().toLowerCase();
  if (["settlement", "capture", "paid", "success"].includes(lowered))
    return "paid";
  if (["cancel", "cancelled"].includes(lowered)) return "cancelled";
  if (["failure", "failed", "deny"].includes(lowered)) return "failed";
  if (["expire", "expired"].includes(lowered)) return "expired";
  return "pending";
};

const upsertBookingAndTransaction = async ({
  user,
  orderId,
  summary,
  cartItems,
  snapTransaction,
}) => {
  const uId = user.id || user.id;
  if (!uId) throw createHttpError(401, "Sesi tidak valid");

  // Check unique references with table scans
  const scanB = await dynamoDB.send(
    new ScanCommand({
      TableName: TABLES.BOOKINGS,
      FilterExpression: "payment.reference = :ref",
      ExpressionAttributeValues: { ":ref": orderId },
    }),
  );
  let booking = scanB.Items?.[0];

  const { date, startTime, endTime } = resolveScheduleFromCart(
    cartItems,
    summary.totalDuration,
  );
  const services = buildBookedServicesFromCart(cartItems);

  if (!booking) {
    const bookingId = uuidv4();
    booking = {
      bookingId,
      user: uId,
      services: services.map((s) => ({
        service: s.serviceId,
        name: s.name,
        price: s.price,
        durationMinutes: s.durationMinutes,
      })),
      startTime,
      endTime,
      status: "pending",
      slot: { date },
      payment: {
        method: "midtrans",
        status: "pending",
        totalAmount: summary.total,
        reference: orderId,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.BOOKINGS, Item: booking }),
    );
  }

  const txRes = await dynamoDB.send(
    new GetCommand({
      TableName: TABLES.TRANSACTIONS,
      Key: { transactionId: orderId },
    }),
  );
  let transaction = txRes.Item;

  if (!transaction) {
    transaction = {
      transactionId: orderId,
      booking: booking.bookingId,
      user: uId,
      amount: summary.total,
      method: "midtrans",
      status: "pending",
      reference: orderId,
      orderId,
      bookedServices: services,
      metadata: {
        couponCode: summary.coupon?.code || null,
        subtotal: summary.subtotal,
        discountAmount: summary.discountAmount,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (snapTransaction) {
    transaction.orderId = snapTransaction.orderid ?? transaction.orderId;
    transaction.reference = snapTransaction.orderid ?? transaction.reference;
    transaction.paymentType =
      snapTransaction.payment_type ?? transaction.paymentType;
    transaction.grossAmount =
      snapTransaction.gross_amount !== undefined
        ? Number(snapTransaction.gross_amount)
        : transaction.grossAmount;
    transaction.midtransResponse = snapTransaction;
    transaction.status = normaliseMidtransStatus(
      snapTransaction.transaction_status,
    );
  }

  await dynamoDB.send(
    new PutCommand({ TableName: TABLES.TRANSACTIONS, Item: transaction }),
  );

  // Synchronize dynamic booking payment metrics block state
  booking.payment.method = transaction.method || "midtrans";
  booking.payment.totalAmount =
    transaction.amount ?? booking.payment.totalAmount;
  booking.payment.status =
    transaction.status === "paid"
      ? "paid"
      : ["cancelled", "failed"].includes(transaction.status)
        ? "refunded"
        : "pending";
  booking.updatedAt = new Date().toISOString();

  await dynamoDB.send(
    new PutCommand({ TableName: TABLES.BOOKINGS, Item: booking }),
  );

  return { booking, transaction };
};

const buildCustomerDetails = (user) => {
  if (!user) return { first_name: "Customer" };
  const parts = (user.fullName || "").trim().split(/\s+/);
  const firstName = parts.shift() || "Customer";
  return {
    first_name: firstName,
    ...(parts.length && { last_name: parts.join(" ") }),
    ...(user.email && { email: user.email }),
    ...(user.phone && { phone: user.phone }),
  };
};

const buildSnapItemDetails = (cartItems, subtotal, discountAmount, coupon) => {
  const details = [];
  let accumulatedSubtotal = 0;

  cartItems.forEach((item, index) => {
    let lineTotal = 0;
    const mainPrice = normaliseAmount(item.cartMain?.price ?? 0);
    if (item.cartMain && mainPrice > 0) {
      details.push({
        id: `MAIN-${item.cartMain.serviceId || index + 1}`,
        name: item.cartMain.name || item.name,
        price: mainPrice,
        quantity: 1,
      });
      lineTotal += mainPrice;
    }
    item.cartExtras.forEach((extra, exIdx) => {
      const exPrice = normaliseAmount(extra.price);
      if (exPrice > 0) {
        details.push({
          id: `EXTRA-${extra.serviceId || `${index + 1}-${exIdx + 1}`}`,
          name: extra.name,
          price: exPrice,
          quantity: 1,
        });
        lineTotal += exPrice;
      }
    });

    const resolvedPrice = normaliseAmount(item.price);
    if (resolvedPrice > lineTotal) {
      const delta = normaliseAmount(resolvedPrice - lineTotal);
      details.push({
        id: `PKG-${index + 1}`,
        name: item.name,
        price: delta,
        quantity: 1,
      });
      lineTotal += delta;
    } else if (lineTotal > resolvedPrice) {
      const delta = normaliseAmount(lineTotal - resolvedPrice);
      details.push({
        id: `PKG-ADJ-${index + 1}`,
        name: `Penyesuaian ${item.name}`,
        price: -delta,
        quantity: 1,
      });
      lineTotal -= delta;
    }
    accumulatedSubtotal += lineTotal;
  });

  const subtotalDelta = normaliseSignedAmount(subtotal - accumulatedSubtotal);
  if (subtotalDelta !== 0) {
    details.push({
      id: subtotalDelta > 0 ? "SUBTOTAL-ADJUST" : "SUBTOTAL-CORRECT",
      name: "Penyesuaian Subtotal",
      price: subtotalDelta,
      quantity: 1,
    });
  }
  if (discountAmount > 0) {
    details.push({
      id: "COUPON-DISCOUNT",
      name: coupon ? `Diskon Kupon ${coupon.code}` : "Diskon",
      price: -normaliseAmount(discountAmount),
      quantity: 1,
    });
  }
  return details;
};

const ACTIVE_STATUSES = ["pending", "confirmed", "in-progress"];
const SETTINGS_NOTIFICATION_KEYS = [
  "email",
  "sms",
  "push",
  "bookingReminders",
  "promotions",
  "newsletter",
];
const DEFAULT_NOTIFICATION_PREFS = {
  email: true,
  sms: false,
  push: true,
  bookingReminders: true,
  promotions: false,
  newsletter: true,
};

const extractNotificationPrefs = (user) => {
  const raw = user?.notificationPrefs || {};
  const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
  SETTINGS_NOTIFICATION_KEYS.forEach((key) => {
    if (raw[key] !== undefined) prefs[key] = Boolean(raw[key]);
  });
  return prefs;
};

const buildSettingsResponse = (user) => ({
  theme: user?.preferences?.theme === "dark" ? "dark" : "light",
  darkMode: user?.preferences?.theme === "dark",
  notificationPrefs: extractNotificationPrefs(user),
  status: user?.status ?? "active",
  deactivation: user?.deactivation ?? null,
  updatedAt: user?.updatedAt ?? null,
});

router.use(authenticate);
router.use(authorizeRoles("customer"));

// GET CALENDAR AVAILABILITY
router.get("/availability", async (req, res) => {
  try {
    const { month, date: dateParam, durationMinutes } = req.query ?? {};
    const targetMonth =
      parseMonthParam(month) ||
      new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const startOfMonth = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
    );

    const monthStartKey = toDateKey(startOfMonth);
    const monthEndKey = toDateKey(endOfMonth);
    const slotDurationRequested = Number.parseInt(durationMinutes, 10);
    const effectiveSlotDuration = Number.isFinite(slotDurationRequested)
      ? Math.max(slotDurationRequested, MINUTE_STEP)
      : 60;

    // Scan users table manually to aggregate structural count numbers of stylists
    const usersRes = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.USERS }),
    );
    const staffCount = (usersRes.Items || []).filter(
      (u) => u.staffProfile !== undefined && u.staffProfile !== null,
    ).length;
    const effectiveStaff = Math.max(staffCount, 1);

    const bookingsRes = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.BOOKINGS }),
    );
    const allBookings = bookingsRes.Items || [];
    const monthlyBookings = allBookings.filter(
      (b) =>
        b.slot?.date >= monthStartKey &&
        b.slot?.date <= monthEndKey &&
        b.status !== "cancelled",
    );

    const bookingsByDate = new Map();
    monthlyBookings.forEach((booking) => {
      const dateKey = booking?.slot?.date;
      if (!dateKey) return;
      const startMinutes = minutesFromDate(booking.startTime);
      const endMinutes = minutesFromDate(booking.endTime);
      if (startMinutes === null || endMinutes === null) return;

      const currentList = bookingsByDate.get(dateKey) || [];
      currentList.push({ startMinutes, endMinutes });
      bookingsByDate.set(dateKey, currentList);
    });

    const days = [];
    const iterator = new Date(startOfMonth);

    while (iterator <= endOfMonth) {
      const dateKey = toDateKey(iterator);
      const dayOfWeek = iterator.getDay();
      const isClosed = dayOfWeek === CLOSED_DAY_INDEX || staffCount === 0;
      const bookingsForDay = bookingsByDate.get(dateKey) || [];

      const totalBookedMinutes = bookingsForDay.reduce((acc, entry) => {
        const start = clampToWorkday(entry.startMinutes) ?? WORK_START_MINUTE;
        const end = clampToWorkday(entry.endMinutes) ?? WORK_END_MINUTE;
        return acc + Math.max(end - start, 0);
      }, 0);

      const totalCapacityMinutes = isClosed
        ? 0
        : effectiveStaff * WORK_MINUTES_PER_STAFF;
      const remainingMinutes = Math.max(
        totalCapacityMinutes - totalBookedMinutes,
        0,
      );
      const fitsRequest =
        !isClosed &&
        (slotDurationRequested > 0
          ? remainingMinutes >= effectiveSlotDuration
          : remainingMinutes > 0);

      let status = "available";
      if (isClosed || remainingMinutes === 0) status = "full";
      else if (!fitsRequest) status = "partial";

      days.push({
        date: dateKey,
        dayOfWeek,
        isClosed,
        remainingMinutes,
        fitsRequest,
        status,
      });
      iterator.setDate(iterator.getDate() + 1);
    }

    const selectedDateKey =
      typeof dateParam === "string" && dateParam.trim()
        ? dateParam.trim()
        : null;
    let slots = null;

    if (selectedDateKey) {
      const slotsBookings = bookingsByDate.get(selectedDateKey) || [];
      const slotsTimeline = buildTimeline(slotsBookings);
      slots = {
        date: selectedDateKey,
        slotDurationMinutes: effectiveSlotDuration,
        incrementMinutes: SLOT_INCREMENT_MINUTES,
        options: buildSlotOptions({
          timeline: slotsTimeline,
          slotDuration: effectiveSlotDuration,
          staffCount,
        }),
      };
    }

    res.json({
      month: {
        year: targetMonth.getFullYear(),
        month: targetMonth.getMonth() + 1,
      },
      staff: {
        totalStaff: staffCount,
        minutesPerStaff: WORK_MINUTES_PER_STAFF,
        workStart: formatTimePoint(WORK_START_MINUTE),
        workEnd: formatTimePoint(WORK_END_MINUTE),
      },
      days,
      slots,
    });
  } catch (error) {
    console.error("Failed to load availability", error);
    res.status(500).json({ message: "Failed to load availability" });
  }
});

// GET SERVICES FOR CUSTOMER PORTAL
router.get("/services", async (req, res) => {
  try {
    const { search, categoryId } = req.query ?? {};
    const response = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.SERVICES }),
    );
    let records = (response.Items || []).filter((s) => s.active === true);

    if (search && typeof search === "string" && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      records = records.filter(
        (s) => regex.test(s.name) || regex.test(s.description || ""),
      );
    }

    if (categoryId) {
      records = records.filter((s) => s.categoryId === categoryId.toString());
    }

    // Sort matching your dashboard definitions
    records.sort(
      (a, b) =>
        (b.featured ? 1 : 0) - (a.featured ? 1 : 0) ||
        new Date(b.createdAt) - new Date(a.createdAt),
    );
    records = records.map((s) => ({ ...s, id: s.serviceId }));

    res.json({ services: buildServicesResponse(records) });
  } catch (error) {
    console.error("Failed to load customer services", error);
    res.status(500).json({ message: "Failed to load services" });
  }
});

// PROFILE & PASSWORDS HANDLERS
router.get("/profile", async (req, res) => {
  try {
    const uId = req.user.id || req.user.id;
    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: uId } }),
    );
    if (!result.Item)
      return res.status(404).json({ message: "User not found" });
    res.json({ user: buildUserPayload({ ...result.Item, id: uId }) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load profile" });
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const { fullName, email, phone, avatarUrl } = req.body ?? {};
    const uId = req.user.id || req.user.id;

    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: uId } }),
    );
    if (!result.Item)
      return res.status(404).json({ message: "User not found" });

    let expressions = ["SET updatedAt = :now"];
    let values = { ":now": new Date().toISOString() };

    if (email !== undefined) {
      const norm = normalizeEmail(email);
      if (!norm)
        return res.status(400).json({ message: "Email cannot be empty" });
      if (norm !== result.Item.email) {
        const check = await dynamoDB.send(
          new ScanCommand({
            TableName: TABLES.USERS,
            FilterExpression: "email = :email",
            ExpressionAttributeValues: { ":email": norm },
          }),
        );
        if (check.Items && check.Items.length > 0)
          return res.status(409).json({ message: "Email is already in use" });
        expressions.push("email = :email");
        values[":email"] = norm;
      }
    }
    if (fullName !== undefined) {
      if (!fullName)
        return res.status(400).json({ message: "Full name cannot be empty" });
      expressions.push("fullName = :fName");
      values[":fName"] = fullName;
    }
    if (phone !== undefined) {
      if (!phone)
        return res
          .status(400)
          .json({ message: "Phone number cannot be empty" });
      expressions.push("phone = :phone");
      values[":phone"] = phone;
    }
    if (avatarUrl !== undefined) {
      expressions.push("avatarUrl = :avatar");
      values[":avatar"] = avatarUrl || null;
    }

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { id: uId },
        UpdateExpression: expressions.join(", "),
        ExpressionAttributeValues: values,
      }),
    );
    const fresh = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: uId } }),
    );
    res.json({ user: buildUserPayload({ ...fresh.Item, id: uId }) });
  } catch (error) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

router.post("/profile/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    const uId = req.user.id || req.user.id;
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    if (newPassword.length < 8)
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });

    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: uId } }),
    );
    if (!result.Item)
      return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(
      currentPassword,
      result.Item.passwordHash,
    );
    if (!isMatch)
      return res.status(400).json({ message: "Current password is incorrect" });

    const nextHash = await bcrypt.hash(newPassword, 10);
    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { id: uId },
        UpdateExpression: "SET passwordHash = :hash, updatedAt = :now",
        ExpressionAttributeValues: {
          ":hash": nextHash,
          ":now": new Date().toISOString(),
        },
      }),
    );
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to update password" });
  }
});

// CUSTOMER HOME METRICS PORTAL DASHBOARD
router.get("/dashboard", async (req, res) => {
  try {
    const uId = req.user.id || req.user.id;

    const bookingsRes = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.BOOKINGS }),
    );
    const myBookings = (bookingsRes.Items || []).filter((b) => b.user === uId);

    const totalBookings = myBookings.length;
    const activeBookings = myBookings.filter((b) =>
      ACTIVE_STATUSES.includes(b.status),
    ).length;
    const completedServices = myBookings.filter(
      (b) => b.status === "completed",
    ).length;

    // Fetch users mapping stack cleanly for stylist population references
    const usersRes = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.USERS }),
    );
    const usersList = usersRes.Items || [];

    const populatedBookings = myBookings.map((b) => {
      const matchStylist = usersList.find((u) => u.id === b.stylist);
      return {
        ...b,
        id: b.bookingId,
        stylist: matchStylist
          ? { ...matchStylist, id: matchStylist.id }
          : null,
      };
    });

    populatedBookings.sort(
      (a, b) => new Date(b.startTime) - new Date(a.startTime),
    );
    const recentBookings = populatedBookings.slice(0, 10);

    const nowStr = new Date().toISOString();
    const upcomingBooking =
      populatedBookings
        .filter(
          (b) => ACTIVE_STATUSES.includes(b.status) && b.startTime >= nowStr,
        )
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0] ||
      null;

    res.json({
      stats: { totalBookings, activeBookings, completedServices },
      recentBookings: buildBookingsResponse(recentBookings),
      upcomingBooking: upcomingBooking
        ? buildBookingPayload(upcomingBooking)
        : null,
    });
  } catch (error) {
    console.error("Failed to load customer dashboard", error);
    res.status(500).json({ message: "Failed to load dashboard" });
  }
});

// HISTORICAL BOOKINGS (WITH PAGINATION PROCESSING)
router.get("/bookings", async (req, res) => {
  try {
    const uId = req.user.id || req.user.id;
    const {
      status,
      page: pageParam = "1",
      limit: limitParam = "10",
      sort = "desc",
    } = req.query ?? {};

    const page = Math.max(Number.parseInt(pageParam, 10) || 1, 1);
    const limit = Math.min(
      Math.max(Number.parseInt(limitParam, 10) || 10, 1),
      100,
    );
    const normalizedStatus =
      typeof status === "string" ? status.trim().toLowerCase() : "";

    const bookingsRes = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.BOOKINGS }),
    );
    let records = (bookingsRes.Items || []).filter((b) => b.user === uId);

    const nowStr = new Date().toISOString();
    if (normalizedStatus && normalizedStatus !== "all") {
      if (normalizedStatus === "upcoming") {
        records = records.filter(
          (b) => ACTIVE_STATUSES.includes(b.status) && b.startTime >= nowStr,
        );
      } else if (["completed", "cancelled"].includes(normalizedStatus)) {
        records = records.filter((b) => b.status === normalizedStatus);
      } else {
        records = records.filter((b) => b.status === normalizedStatus);
      }
    }

    const totalForFilter = records.length;
    const sortOrder = sort === "asc" ? 1 : -1;
    records.sort(
      (a, b) => (new Date(a.startTime) - new Date(b.startTime)) * sortOrder,
    );

    // Dynamic extraction skip boundaries
    const skip = (page - 1) * limit;
    let paginated = records.slice(skip, skip + limit);

    const usersRes = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.USERS }),
    );
    const usersList = usersRes.Items || [];

    paginated = paginated.map((b) => {
      const stylistMatch = usersList.find((u) => u.id === b.stylist);
      return {
        ...b,
        id: b.bookingId,
        stylist: stylistMatch
          ? { ...stylistMatch, id: stylistMatch.id }
          : null,
      };
    });

    const totalPages =
      totalForFilter > 0 ? Math.ceil(totalForFilter / limit) : 0;
    const allMyBookings = (bookingsRes.Items || []).filter(
      (b) => b.user === uId,
    );

    res.json({
      bookings: buildBookingsResponse(paginated),
      pagination: {
        page,
        limit,
        total: totalForFilter,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
      },
      stats: {
        total: allMyBookings.length,
        upcoming: allMyBookings.filter(
          (b) => ACTIVE_STATUSES.includes(b.status) && b.startTime >= nowStr,
        ).length,
        completed: allMyBookings.filter((b) => b.status === "completed").length,
        cancelled: allMyBookings.filter((b) => b.status === "cancelled").length,
      },
    });
  } catch (error) {
    console.error("Failed to load customer bookings", error);
    res.status(500).json({ message: "Failed to load bookings" });
  }
});

// CUSTOMER THEME SETTINGS CONFIGS
router.get("/settings", async (req, res) => {
  try {
    const uId = req.user.id || req.user.id;
    const user = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: uId } }),
    );
    if (!user.Item) return res.status(404).json({ message: "User not found" });
    res.json({ settings: buildSettingsResponse(user.Item) });
  } catch (error) {
    res.status(500).json({ message: "Failed to load settings" });
  }
});

router.patch("/settings", async (req, res) => {
  try {
    const uId = req.user.id || req.user.id;
    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: uId } }),
    );
    if (!result.Item)
      return res.status(404).json({ message: "User not found" });

    const { darkMode, theme, notificationPrefs } = req.body ?? {};
    let userItem = { ...result.Item };
    let hasChanges = false;

    if (typeof darkMode === "boolean" || typeof theme === "string") {
      const resolvedTheme =
        typeof theme === "string"
          ? theme.toLowerCase() === "dark"
            ? "dark"
            : "light"
          : darkMode
            ? "dark"
            : "light";
      userItem.preferences ??= {};
      if (userItem.preferences.theme !== resolvedTheme) {
        userItem.preferences.theme = resolvedTheme;
        hasChanges = true;
      }
    }

    if (notificationPrefs && typeof notificationPrefs === "object") {
      userItem.notificationPrefs ??= {};
      SETTINGS_NOTIFICATION_KEYS.forEach((key) => {
        if (notificationPrefs[key] !== undefined) {
          const val = Boolean(notificationPrefs[key]);
          if (userItem.notificationPrefs[key] !== val) {
            userItem.notificationPrefs[key] = val;
            hasChanges = true;
          }
        }
      });
    }

    if (!hasChanges)
      return res
        .status(400)
        .json({ message: "No settings changes were provided" });
    userItem.updatedAt = new Date().toISOString();

    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.USERS, Item: userItem }),
    );
    res.json({
      settings: buildSettingsResponse(userItem),
      user: buildUserPayload({ ...userItem, id: uId }),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update settings" });
  }
});

router.post("/settings/deactivate", async (req, res) => {
  try {
    const uId = req.user.id || req.user.id;
    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: uId } }),
    );
    if (!result.Item)
      return res.status(404).json({ message: "User not found" });

    const { reason } = req.body ?? {};
    const trimmedReason =
      typeof reason === "string" && reason.trim() ? reason.trim() : null;
    const requestedAt = new Date();
    const expiresAt = new Date(
      requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { id: uId },
        UpdateExpression:
          "SET #uStatus = :status, deactivation = :deact, updatedAt = :now",
        ExpressionAttributeNames: { "#uStatus": "status" },
        ExpressionAttributeValues: {
          ":status": "inactive",
          ":deact": {
            reason: trimmedReason,
            requestedAt: requestedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
          ":now": requestedAt.toISOString(),
        },
      }),
    );

    const fresh = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: uId } }),
    );
    res.json({
      message: "Account deactivated successfully.",
      user: buildUserPayload({ ...fresh.Item, id: uId }),
      settings: buildSettingsResponse(fresh.Item),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to deactivate account" });
  }
});

// CHECKOUT & REDEMPTION SYSTEM CODES WITH MIDTRANS SNAP HANDLERS
router.post("/cart/redeem-coupon", async (req, res) => {
  try {
    const { code, items } = req.body ?? {};
    const summary = await buildCartPricingSummary({
      items,
      couponCode: code,
      requireCoupon: true,
    });
    res.json({
      coupon: buildCouponPayload({
        ...summary.coupon,
        id: summary.coupon.couponId,
      }),
      subtotal: summary.subtotal,
      discountAmount: summary.discountAmount,
      total: summary.total,
      totalDuration: summary.totalDuration,
    });
  } catch (error) {
    res
      .status(error?.status || 500)
      .json({ message: error?.message || "Gagal memeriksa kupon" });
  }
});

router.post("/checkout/snap-token", async (req, res) => {
  try {
    const { items, couponCode } = req.body ?? {};
    const summary = await buildCartPricingSummary({ items, couponCode });
    if (summary.total <= 0)
      throw createHttpError(400, "Total transaksi tidak valid untuk diproses");

    const snap = getSnapClient();
    const uId = req.user.id || req.user.id;
    const orderId = buildOrderId(uId);

    const itemDetails = buildSnapItemDetails(
      summary.items,
      summary.subtotal,
      summary.discountAmount,
      summary.coupon,
    );
    const callbacks = buildSnapCallbacks(req);

    const parameter = {
      transaction_details: { orderid: orderId, gross_amount: summary.total },
      item_details: itemDetails,
      customer_details: buildCustomerDetails(req.user),
      credit_card: { secure: true },
      custom_field1: uId.toString(),
      custom_field2: summary.coupon?.code ?? undefined,
    };

    if (Object.keys(callbacks).length) parameter.callbacks = callbacks;

    const transaction = await snap.createTransaction(parameter);
    if (!transaction?.token)
      throw createHttpError(502, "Midtrans tidak mengembalikan token");

    // Reconstruct structural payload formats mapping core schema representations inside upsert variables
    await upsertBookingAndTransaction({
      user: { ...req.user, id: uId },
      orderId,
      summary,
      cartItems: summary.items,
      snapTransaction: transaction,
    });

    res.json({
      token: transaction.token,
      redirectUrl: transaction.redirect_url,
      orderId,
      subtotal: summary.subtotal,
      discountAmount: summary.discountAmount,
      total: summary.total,
      coupon: summary.coupon
        ? buildCouponPayload({
            ...summary.coupon,
            id: summary.coupon.couponId,
          })
        : null,
    });
  } catch (error) {
    res
      .status(error?.status || (error?.ApiResponse ? 502 : 500))
      .json({ message: error?.message || "Gagal membuat token pembayaran" });
  }
});

export default router;

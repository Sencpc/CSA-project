import express from "express";
import { createHash } from "node:crypto";
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  buildTransactionPayload,
  buildTransactionsResponse,
  buildTransactionStats,
} from "../utils/serializers.js";

const router = express.Router();

const parseDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const normaliseStatus = (status) => {
  if (!status) return undefined;
  const lowered = status.toString().toLowerCase();
  switch (lowered) {
    case "settlement":
    case "capture":
    case "paid":
    case "done":
    case "success":
      return "paid";
    case "pending":
    case "draft":
      return "pending";
    case "cancel":
    case "cancelled":
      return "cancelled";
    case "failure":
    case "failed":
      return "failed";
    case "void":
    case "voided":
      return "voided";
    case "expire":
    case "expired":
      return "expired";
    case "overdue":
      return "overdue";
    case "refunded":
    case "refund":
      return "refunded";
    default:
      return lowered;
  }
};

const applyInvoiceDetails = (transaction, invoice) => {
  if (!invoice || typeof invoice !== "object") {
    return transaction;
  }

  transaction.orderId = invoice.orderid ?? transaction.orderId;
  transaction.reference = invoice.reference ?? transaction.reference;
  transaction.paymentType = invoice.payment_type ?? transaction.paymentType;
  transaction.grossAmount =
    invoice.gross_amount !== undefined
      ? Number(invoice.gross_amount)
      : transaction.grossAmount;
  transaction.amount =
    invoice.gross_amount !== undefined
      ? Number(invoice.gross_amount)
      : transaction.amount;

  transaction.invoice = {
    id: invoice.id ?? transaction.invoice?.id,
    number: invoice.invoice_number ?? transaction.invoice?.number,
    title: invoice.invoice_title ?? transaction.invoice?.title,
    paidTitle: invoice.invoice_paid_title ?? transaction.invoice?.paidTitle,
    publishedAt:
      parseDate(invoice.published_date)?.toISOString() ??
      transaction.invoice?.publishedAt,
    dueDate:
      parseDate(invoice.due_date)?.toISOString() ??
      transaction.invoice?.dueDate,
    invoiceDate:
      parseDate(invoice.invoice_date)?.toISOString() ??
      transaction.invoice?.invoiceDate,
    pdfUrl: invoice.pdf_url ?? transaction.invoice?.pdfUrl,
    paymentLinkUrl:
      invoice.payment_link_url ?? transaction.invoice?.paymentLinkUrl,
  };

  if (invoice.customer_details) {
    transaction.customer = {
      customerId: invoice.customer_details.id,
      name: invoice.customer_details.name,
      email: invoice.customer_details.email,
      phone: invoice.customer_details.phone,
    };
  }

  if (Array.isArray(invoice.item_details)) {
    transaction.items = invoice.item_details.map((item) => ({
      itemId: item.itemid ?? item.id,
      name: item.name ?? item.description,
      description: item.description,
      quantity: item.quantity !== undefined ? Number(item.quantity) : undefined,
      price: item.price !== undefined ? Number(item.price) : undefined,
      total: item.total !== undefined ? Number(item.total) : undefined,
    }));
  }

  if (Array.isArray(invoice.virtual_accounts)) {
    transaction.virtualAccounts = invoice.virtual_accounts.map((va) => ({
      bank: va.bank,
      vaNumber: va.va_number ?? va.vaNumber,
      paymentCode: va.payment_code ?? va.paymentCode,
      billerCode: va.biller_code ?? va.billerCode,
      channel: va.channel,
      grossAmount:
        va.gross_amount !== undefined ? Number(va.gross_amount) : undefined,
      expiresAt: parseDate(va.expiration_date ?? va.expires_at)?.toISOString(),
    }));
  }

  transaction.midtransResponse = invoice;

  const status = normaliseStatus(invoice.status);
  if (status) {
    transaction.status = status;
  }

  return transaction;
};

const snapshotBookedServices = (booking) =>
  Array.isArray(booking?.services)
    ? booking.services.map((serviceItem) => ({
        serviceId: serviceItem.service ?? serviceItem.serviceId,
        name: serviceItem.name,
        price: serviceItem.price,
        durationMinutes: serviceItem.durationMinutes,
      }))
    : [];

const updateBookingPayment = async (booking, transaction) => {
  if (!booking) return;

  let payment = booking.payment || {};
  payment.method = transaction.method ?? payment.method;
  payment.totalAmount = transaction.amount ?? payment.totalAmount;
  payment.invoiceNo = transaction.invoice?.number ?? payment.invoiceNo;
  payment.reference =
    transaction.reference ?? transaction.orderId ?? payment.reference;

  switch (transaction.status) {
    case "paid":
      payment.status = "paid";
      break;
    case "failed":
    case "cancelled":
    case "voided":
      payment.status = "refunded";
      break;
    case "pending":
    case "draft":
      payment.status = "pending";
      break;
    case "expired":
    case "overdue":
      payment.status = "unpaid";
      break;
    default:
      if (!payment.status) payment.status = "pending";
      break;
  }

  await dynamoDB.send(
    new UpdateCommand({
      TableName: TABLES.BOOKINGS,
      Key: { bookingId: booking.bookingId },
      UpdateExpression: "SET payment = :p, updatedAt = :now",
      ExpressionAttributeValues: {
        ":p": payment,
        ":now": new Date().toISOString(),
      },
    }),
  );
};

// Helper: Simulate multi-document hydration mapping in memory
const populateTransactionsMemory = async (rawTx) => {
  if (!rawTx.length) return [];

  const [usersRes, bookingsRes] = await Promise.all([
    dynamoDB.send(new ScanCommand({ TableName: TABLES.USERS })),
    dynamoDB.send(new ScanCommand({ TableName: TABLES.BOOKINGS })),
  ]);

  const users = usersRes.Items || [];
  const bookings = bookingsRes.Items || [];

  return rawTx.map((t) => {
    const userMatch = users.find((u) => u.id === t.user);
    const bookingMatch = bookings.find((b) => b.bookingId === t.booking);

    return {
      ...t,
      id: t.transactionId,
      user: userMatch ? { ...userMatch, id: userMatch.id } : null,
      booking: bookingMatch
        ? { ...bookingMatch, id: bookingMatch.bookingId }
        : null,
    };
  });
};

// MIDTRANS WEBHOOK NOTIFICATION
router.post("/midtrans-notify", async (req, res) => {
  try {
    const payload = req.body ?? {};
    const serverKey = process.env.MIDTRANS_SERVER_KEY;

    if (!serverKey) {
      return res.status(500).json({ message: "Midtrans server key missing" });
    }

    const {
      orderid: orderId,
      status_code: statusCode,
      gross_amount: grossAmount,
      signature_key: signatureKey,
    } = payload;

    if (!orderId || !statusCode || !grossAmount || !signatureKey) {
      return res
        .status(400)
        .json({ message: "Invalid Midtrans notification payload" });
    }

    const rawSignature = `${orderId}${statusCode}${grossAmount}${serverKey}`;
    const expectedSignature = createHash("sha512")
      .update(rawSignature)
      .digest("hex");

    if (expectedSignature !== signatureKey) {
      return res.status(401).json({ message: "Invalid Midtrans signature" });
    }

    // Get primary transaction item
    const txGet = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.TRANSACTIONS,
        Key: { transactionId: orderId },
      }),
    );
    let transaction = txGet.Item;
    let booking = null;

    if (!transaction) {
      // Find backup booking relationship path via cross-table scanning
      const bookingScan = await dynamoDB.send(
        new ScanCommand({
          TableName: TABLES.BOOKINGS,
          FilterExpression: "payment.reference = :ref",
          ExpressionAttributeValues: { ":ref": orderId },
        }),
      );
      booking = bookingScan.Items?.[0];

      if (booking) {
        transaction = {
          transactionId: orderId,
          booking: booking.bookingId,
          user: booking.user,
          amount: Number(grossAmount) || 0,
          method: "midtrans",
          status: "pending",
          orderId,
          reference: orderId,
          createdAt: new Date().toISOString(),
        };
      }
    }

    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const applied = applyInvoiceDetails(transaction, payload);
    let status = normaliseStatus(payload.transaction_status) || applied.status;
    if (
      payload.transaction_status === "capture" &&
      payload.fraud_status === "challenge"
    ) {
      status = "pending";
    }

    applied.status = status;
    applied.midtransResponse = payload;
    applied.updatedAt = new Date().toISOString();

    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.TRANSACTIONS, Item: applied }),
    );

    if (!booking) {
      const bGet = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.BOOKINGS,
          Key: { bookingId: applied.booking },
        }),
      );
      booking = bGet.Item;
    }

    if (booking) {
      await updateBookingPayment(booking, applied);
    }

    res.json({ received: true, orderId, status: applied.status });
  } catch (error) {
    console.error("Failed to process Midtrans notification", error);
    res
      .status(500)
      .json({ message: "Failed to process Midtrans notification" });
  }
});

router.use(authenticate);
router.use(authorizeRoles("admin"));

// GET ALL TRANSACTIONS
router.get("/", async (req, res) => {
  try {
    const q = req.query ?? {};
    const response = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.TRANSACTIONS }),
    );
    let records = response.Items || [];

    // In-Memory JavaScript filtration logic
    if (q.status) {
      const statuses = q.status
        .split(",")
        .map((val) => normaliseStatus(val.trim()))
        .filter(Boolean);
      if (statuses.length > 0) {
        records = records.filter((t) => statuses.includes(t.status));
      }
    }
    if (q.paymentType)
      records = records.filter((t) => t.paymentType === q.paymentType);
    if (q.bookingId) records = records.filter((t) => t.booking === q.bookingId);
    if (q.orderId) records = records.filter((t) => t.orderId === q.orderId);
    if (q.reference)
      records = records.filter((t) => t.reference === q.reference);

    if (q.dateFrom || q.dateTo) {
      records = records.filter((t) => {
        if (!t.createdAt) return false;
        if (q.dateFrom && t.createdAt < new Date(q.dateFrom).toISOString())
          return false;
        if (q.dateTo && t.createdAt > new Date(q.dateTo).toISOString())
          return false;
        return true;
      });
    }

    if (q.search) {
      const regex = new RegExp(q.search.trim(), "i");
      records = records.filter(
        (t) =>
          regex.test(t.orderId) ||
          regex.test(t.reference) ||
          regex.test(t.invoice?.number || "") ||
          regex.test(t.customer?.name || "") ||
          regex.test(t.customer?.email || ""),
      );
    }

    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const populated = await populateTransactionsMemory(records);

    res.json({
      transactions: buildTransactionsResponse(populated),
      stats: buildTransactionStats(populated),
    });
  } catch (error) {
    console.error("Failed to fetch transactions", error);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

// GET SINGLE TRANSACTION
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const response = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.TRANSACTIONS,
        Key: { transactionId: id },
      }),
    );

    if (!response.Item) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const populated = await populateTransactionsMemory([response.Item]);
    res.json({ transaction: buildTransactionPayload(populated[0]) });
  } catch (error) {
    console.error("Failed to fetch transaction", error);
    res.status(500).json({ message: "Failed to fetch transaction" });
  }
});

// CREATE MANUAL TRANSACTION ENTRY
router.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.bookingId)
      return res.status(400).json({ message: "bookingId is required" });
    if (!body.midtransInvoice || typeof body.midtransInvoice !== "object") {
      return res
        .status(400)
        .json({ message: "midtransInvoice payload is required" });
    }

    const bGet = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.BOOKINGS,
        Key: { bookingId: body.bookingId },
      }),
    );
    const booking = bGet.Item;
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const resolvedid = body.id || booking.user;
    if (!resolvedid)
      return res
        .status(400)
        .json({ message: "Unable to resolve transaction user" });

    let transaction = {
      transactionId: body.midtransInvoice.orderid || uuidv4(),
      booking: booking.bookingId,
      user: resolvedid,
      amount:
        body.amount !== undefined
          ? Number(body.amount)
          : Number(body.midtransInvoice.gross_amount ?? 0),
      method: body.method ?? "midtrans",
      status:
        normaliseStatus(body.status) ??
        normaliseStatus(body.midtransInvoice.status) ??
        "pending",
      reference: body.reference ?? body.midtransInvoice.reference,
      paymentType: body.paymentType ?? body.midtransInvoice.payment_type,
      orderId: body.orderId ?? body.midtransInvoice.orderid,
      metadata: body.metadata,
      bookedServices: snapshotBookedServices(booking),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    transaction = applyInvoiceDetails(transaction, body.midtransInvoice);
    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.TRANSACTIONS, Item: transaction }),
    );
    await updateBookingPayment(booking, transaction);

    const populated = await populateTransactionsMemory([transaction]);
    res
      .status(201)
      .json({ transaction: buildTransactionPayload(populated[0]) });
  } catch (error) {
    console.error("Failed to create transaction", error);
    res.status(500).json({ message: "Failed to create transaction" });
  }
});

// UPDATE TRANSACTION PATCH ENTRY
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};

    const txGet = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.TRANSACTIONS,
        Key: { transactionId: id },
      }),
    );
    if (!txGet.Item)
      return res.status(404).json({ message: "Transaction not found" });

    let transaction = { ...txGet.Item };
    if (body.status) {
      const normalized = normaliseStatus(body.status);
      if (normalized) transaction.status = normalized;
    }
    if (body.reference) transaction.reference = body.reference;
    if (body.paymentType) transaction.paymentType = body.paymentType;
    if (body.orderId) transaction.orderId = body.orderId;
    if (body.metadata) transaction.metadata = body.metadata;
    if (body.amount !== undefined) transaction.amount = Number(body.amount);
    if (body.method) transaction.method = body.method;

    if (body.midtransInvoice) {
      transaction = applyInvoiceDetails(transaction, body.midtransInvoice);
    }
    transaction.updatedAt = new Date().toISOString();

    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.TRANSACTIONS, Item: transaction }),
    );

    if (transaction.booking) {
      const bGet = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.BOOKINGS,
          Key: { bookingId: transaction.booking },
        }),
      );
      if (bGet.Item) await updateBookingPayment(bGet.Item, transaction);
    }

    const populated = await populateTransactionsMemory([transaction]);
    res.json({ transaction: buildTransactionPayload(populated[0]) });
  } catch (error) {
    console.error("Failed to update transaction", error);
    res.status(500).json({ message: "Failed to update transaction" });
  }
});

export default router;

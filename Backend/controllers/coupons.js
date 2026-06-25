import express from "express";
import { v4 as uuidv4 } from "uuid";
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  buildCouponPayload,
  buildCouponsResponse,
} from "../utils/serializers.js";

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin"));

const parseBoolean = (value) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
};

const normalizeCode = (code) => {
  if (code === undefined || code === null) return undefined;
  const normalized = code.toString().trim();
  return normalized ? normalized.toUpperCase() : undefined;
};

// GET ALL COUPONS (SCANS WITH COMPLEX DYNAMIC CONDITIONS CALCULATION)
router.get("/", async (req, res) => {
  try {
    const { search, discountType, isActive, expired } = req.query;

    const response = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.COUPONS }),
    );
    let records = response.Items || [];

    // Map mock id configuration for response serializer compatibility
    records = records.map((c) => ({ ...c, id: c.couponId }));

    // Process conditions locally in-memory to match Mongoose array filters
    if (search) {
      const regex = new RegExp(search.trim(), "i");
      records = records.filter(
        (c) => regex.test(c.code) || regex.test(c.description || ""),
      );
    }

    if (discountType && ["percent", "fixed"].includes(discountType)) {
      records = records.filter((c) => c.discountType === discountType);
    }

    const activeFilter = parseBoolean(isActive);
    if (typeof activeFilter === "boolean") {
      records = records.filter((c) => c.isActive === activeFilter);
    }

    if (typeof expired === "string") {
      const isExpired = expired.toLowerCase() === "true";
      const nowStr = new Date().toISOString();

      if (isExpired) {
        records = records.filter((c) => c.endDate && c.endDate < nowStr);
      } else {
        records = records.filter((c) => !c.endDate || c.endDate >= nowStr);
      }
    }

    // Sort by descending configuration
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      coupons: buildCouponsResponse(records),
      total: records.length,
    });
  } catch (error) {
    console.error("Failed to fetch coupons", error);
    res.status(500).json({ message: "Failed to fetch coupons" });
  }
});

// CREATE COUPON
router.post("/", async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      amount,
      minSpend,
      startDate,
      endDate,
      usageLimit,
      isActive,
      serviceIds,
      categoryIds,
      usedCount,
    } = req.body;

    const normalizedCode = normalizeCode(code);
    if (!normalizedCode || !discountType || amount === undefined) {
      return res
        .status(400)
        .json({ message: "Code, discount type, and amount are required" });
    }

    if (!["percent", "fixed"].includes(discountType)) {
      return res.status(400).json({ message: "Invalid discount type" });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Amount must be a positive number" });
    }

    // Checking if a coupon code exists using scan
    const scanCheck = await dynamoDB.send(
      new ScanCommand({
        TableName: TABLES.COUPONS,
        FilterExpression: "code = :code",
        ExpressionAttributeValues: { ":code": normalizedCode },
      }),
    );

    if (scanCheck.Items && scanCheck.Items.length > 0) {
      return res.status(409).json({ message: "Coupon code already exists" });
    }

    const couponId = uuidv4();
    const newCoupon = {
      couponId,
      code: normalizedCode,
      description: description || null,
      discountType,
      amount: numericAmount,
      minSpend: Number(minSpend) || 0,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      usageLimit: usageLimit ? Number(usageLimit) : null,
      usedCount: Number(usedCount) || 0,
      isActive: typeof isActive === "boolean" ? isActive : true,
      serviceIds: Array.isArray(serviceIds) ? serviceIds : [],
      categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.COUPONS,
        Item: newCoupon,
      }),
    );

    res
      .status(201)
      .json({ coupon: buildCouponPayload({ ...newCoupon, id: couponId }) });
  } catch (error) {
    console.error("Failed to create coupon", error);
    res.status(500).json({ message: "Failed to create coupon" });
  }
});

// UPDATE COUPON (PATCH)
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const existing = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.COUPONS,
        Key: { couponId: id },
      }),
    );

    if (!existing.Item) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    let updateExpressions = ["SET updatedAt = :now"];
    let expressionAttributeValues = { ":now": new Date().toISOString() };

    if (body.code) {
      const normalizedCode = normalizeCode(body.code);
      if (normalizedCode !== existing.Item.code) {
        const scanDup = await dynamoDB.send(
          new ScanCommand({
            TableName: TABLES.COUPONS,
            FilterExpression: "code = :code",
            ExpressionAttributeValues: { ":code": normalizedCode },
          }),
        );
        const items = (scanDup.Items || []).filter((c) => c.couponId !== id);
        if (items.length > 0) {
          return res
            .status(409)
            .json({ message: "Coupon code already exists" });
        }
        updateExpressions.push("code = :code");
        expressionAttributeValues[":code"] = normalizedCode;
      }
    }

    if (body.description !== undefined) {
      updateExpressions.push("description = :desc");
      expressionAttributeValues[":desc"] = body.description;
    }

    if (body.discountType) {
      if (!["percent", "fixed"].includes(body.discountType)) {
        return res.status(400).json({ message: "Invalid discount type" });
      }
      updateExpressions.push("discountType = :dType");
      expressionAttributeValues[":dType"] = body.discountType;
    }

    if (body.amount !== undefined) {
      const amt = Number(body.amount);
      if (Number.isNaN(amt) || amt <= 0)
        return res.status(400).json({ message: "Amount must be positive" });
      updateExpressions.push("amount = :amount");
      expressionAttributeValues[":amount"] = amt;
    }

    if (body.minSpend !== undefined) {
      const minS = Number(body.minSpend);
      if (Number.isNaN(minS) || minS < 0)
        return res
          .status(400)
          .json({ message: "Minimum spend must be positive" });
      updateExpressions.push("minSpend = :minSpend");
      expressionAttributeValues[":minSpend"] = minS;
    }

    if (body.startDate !== undefined) {
      updateExpressions.push("startDate = :sDate");
      expressionAttributeValues[":sDate"] = body.startDate
        ? new Date(body.startDate).toISOString()
        : null;
    }

    if (body.endDate !== undefined) {
      updateExpressions.push("endDate = :eDate");
      expressionAttributeValues[":eDate"] = body.endDate
        ? new Date(body.endDate).toISOString()
        : null;
    }

    if (body.usageLimit !== undefined) {
      updateExpressions.push("usageLimit = :uLimit");
      expressionAttributeValues[":uLimit"] = body.usageLimit
        ? Number(body.usageLimit)
        : null;
    }

    if (body.usedCount !== undefined) {
      const uCount = Number(body.usedCount);
      if (Number.isNaN(uCount) || uCount < 0)
        return res.status(400).json({ message: "Invalid used count" });
      updateExpressions.push("usedCount = :uCount");
      expressionAttributeValues[":uCount"] = uCount;
    }

    if (body.isActive !== undefined) {
      const parsedAct = parseBoolean(body.isActive);
      if (typeof parsedAct === "boolean") {
        updateExpressions.push("isActive = :isActive");
        expressionAttributeValues[":isActive"] = parsedAct;
      }
    }

    if (Array.isArray(body.serviceIds)) {
      updateExpressions.push("serviceIds = :sIds");
      expressionAttributeValues[":sIds"] = body.serviceIds;
    }

    if (Array.isArray(body.categoryIds)) {
      updateExpressions.push("categoryIds = :cIds");
      expressionAttributeValues[":cIds"] = body.categoryIds;
    }

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.COUPONS,
        Key: { couponId: id },
        UpdateExpression: updateExpressions.join(", "),
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );

    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.COUPONS, Key: { couponId: id } }),
    );
    res.json({ coupon: buildCouponPayload({ ...result.Item, id: id }) });
  } catch (error) {
    console.error("Failed to update coupon", error);
    res.status(500).json({ message: "Failed to update coupon" });
  }
});

// DELETE COUPON
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const check = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.COUPONS, Key: { couponId: id } }),
    );
    if (!check.Item) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLES.COUPONS,
        Key: { couponId: id },
      }),
    );

    res.json({ message: "Coupon deleted" });
  } catch (error) {
    console.error("Failed to delete coupon", error);
    res.status(500).json({ message: "Failed to delete coupon" });
  }
});

export default router;

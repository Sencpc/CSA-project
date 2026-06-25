import express from "express";
import bcrypt from "bcryptjs";
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
import { buildUserPayload, buildUsersResponse } from "../utils/serializers.js";

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin"));

const normalizeEmail = (email) => email?.toLowerCase?.().trim?.() ?? email;

// Helper: Scan user table to verify duplicate emails
const findUserByEmail = async (email, excludeid = null) => {
  const params = {
    TableName: TABLES.USERS,
    FilterExpression: "email = :email",
    ExpressionAttributeValues: {
      ":email": normalizeEmail(email),
    },
  };
  const response = await dynamoDB.send(new ScanCommand(params));
  let items = response.Items || [];
  if (excludeid) {
    items = items.filter((u) => u.id !== excludeid);
  }
  return items.length > 0 ? items[0] : null;
};

// GET ALL USERS (WITH ADMIN FILTER SCANS)
router.get("/", async (req, res) => {
  try {
    const { search, status, role } = req.query;

    const response = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.USERS }),
    );
    let records = response.Items || [];

    // Map id reference for serializer functions compatibility
    records = records.map((u) => ({ ...u, id: u.id }));

    // Dynamic filtering matching your dashboard criteria
    if (search) {
      const regex = new RegExp(search.trim(), "i");
      records = records.filter(
        (u) =>
          regex.test(u.fullName) || regex.test(u.email) || regex.test(u.phone),
      );
    }

    if (status && ["active", "inactive"].includes(status)) {
      records = records.filter((u) => u.status === status);
    }

    if (role && ["admin", "customer"].includes(role)) {
      records = records.filter((u) => u.role === role);
    }

    // Sort by createdAt desc
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      users: buildUsersResponse(records),
      total: records.length,
    });
  } catch (error) {
    console.error("Failed to fetch users", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// CREATE USER
router.post("/", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      role = "customer",
      status = "active",
      password,
    } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        message: "Full name, email, phone, and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    const userItem = {
      id:id,
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      role,
      status,
      passwordHash,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notificationPrefs: {
        email: true,
        whatsapp: true,
        inApp: true,
        sms: false,
        push: true,
        bookingReminders: true,
        promotions: false,
        newsletter: true,
      },
      preferences: {
        theme: "light",
        favoriteServices: [],
      },
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: userItem,
      }),
    );

    res
      .status(201)
      .json({ user: buildUserPayload({ ...userItem, id: id }) });
  } catch (error) {
    console.error("Failed to create user", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// UPDATE USER (PATCH)
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, role, status, password } = req.body;

    const existingUser = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { id: id },
      }),
    );

    if (!existingUser.Item) {
      return res.status(404).json({ message: "User not found" });
    }

    let updateExpressions = ["SET updatedAt = :now"];
    let expressionAttributeValues = { ":now": new Date().toISOString() };

    if (email) {
      const normalizedEmail = normalizeEmail(email);
      if (normalizedEmail !== existingUser.Item.email) {
        const duplicate = await findUserByEmail(normalizedEmail, id);
        if (duplicate) {
          return res
            .status(409)
            .json({ message: "Email is already registered" });
        }
        updateExpressions.push("email = :email");
        expressionAttributeValues[":email"] = normalizedEmail;
      }
    }

    if (fullName) {
      updateExpressions.push("fullName = :fullName");
      expressionAttributeValues[":fullName"] = fullName.trim();
    }

    if (phone) {
      updateExpressions.push("phone = :phone");
      expressionAttributeValues[":phone"] = phone.trim();
    }

    if (role && ["admin", "customer"].includes(role)) {
      updateExpressions.push("role = :role");
      expressionAttributeValues[":role"] = role;
    }

    if (status && ["active", "inactive"].includes(status)) {
      updateExpressions.push("#uStatus = :status"); // status is an AWS reserved keyword, using an alias
    }

    let expressionAttributeNames = undefined;
    if (status && ["active", "inactive"].includes(status)) {
      expressionAttributeNames = { "#uStatus": "status" };
      expressionAttributeValues[":status"] = status;
    }

    if (password) {
      updateExpressions.push("passwordHash = :hash");
      expressionAttributeValues[":hash"] = await bcrypt.hash(password, 10);
    }

    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.USERS,
        Key: { id: id },
        UpdateExpression: updateExpressions.join(", "),
        ExpressionAttributeValues: expressionAttributeValues,
        ...(expressionAttributeNames && {
          ExpressionAttributeNames: expressionAttributeNames,
        }),
      }),
    );

    const result = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: id } }),
    );
    res.json({ user: buildUserPayload({ ...result.Item, id: id }) });
  } catch (error) {
    console.error("Failed to update user", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// DELETE USER
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Inside server.js, the authenticated request sets user data profile properties on req.user
    // Access string format checking directly
    const currentAdminId = req.user.id || req.user.id;
    if (currentAdminId?.toString() === id) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account" });
    }

    const check = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { id: id } }),
    );
    if (!check.Item) {
      return res.status(404).json({ message: "User not found" });
    }

    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLES.USERS,
        Key: { id: id },
      }),
    );

    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("Failed to delete user", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

export default router;

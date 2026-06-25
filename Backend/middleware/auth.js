import jwt from "jsonwebtoken";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";

const extractTokenFromHeader = (headerValue) => {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const parts = headerValue.split(" ");
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;
  if (/^Bearer$/i.test(scheme) && token) {
    return token;
  }

  return null;
};

export const authenticate = async (req, res, next) => {
  try {
    const headerToken = extractTokenFromHeader(req.headers.authorization);
    const token = headerToken;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT secret is not configured");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Point lookup directly onto your cross-account user table partition key
    const result = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { id: decoded.sub },
      }),
    );

    if (!result.Item) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    req.auth = {
      token,
      payload: decoded,
    };

    // Inject matching backward-compatible id mapping targets
    // to safeguard third-party structural utilities from breaking down
    req.user = {
      ...result.Item,
      id: result.Item.id,
    };

    next();
  } catch (error) {
    console.error("Authentication failed", error);
    if (error?.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired" });
    }
    return res.status(401).json({ message: "Authentication failed" });
  }
};

export const authorizeRoles =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You do not have access to this resource" });
    }

    return next();
  };

export default {
  authenticate,
  authorizeRoles,
};

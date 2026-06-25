import express from "express";
import slugify from "slugify";
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
  buildCategoryPayload,
  buildServicePayload,
  buildServicesResponse,
  buildServiceStats,
} from "../utils/serializers.js";

const router = express.Router();

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (["true", "1", "yes"].includes(lowered)) return true;
    if (["false", "0", "no"].includes(lowered)) return false;
  }
  return undefined;
};

const parseNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseBenefits = (benefits) => {
  if (!benefits) return [];
  if (Array.isArray(benefits)) {
    return benefits
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }
  if (typeof benefits === "string") {
    return benefits
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
};

const ensureCategoryExists = async (categoryId) => {
  if (!categoryId) return null;

  const response = await dynamoDB.send(
    new GetCommand({
      TableName: TABLES.CATEGORIES,
      Key: { categoryId },
    }),
  );

  if (!response.Item) {
    const error = new Error("Category not found");
    error.status = 404;
    throw error;
  }
  return response.Item;
};

const handleServiceError = (res, error, fallbackMessage) => {
  const status = error?.status || 500;
  const message = error?.message || fallbackMessage;
  if (status >= 500) {
    console.error(fallbackMessage, error);
  }
  res.status(status).json({ message });
};

router.use(authenticate);
router.use(authorizeRoles("admin"));

// FETCH ALL SERVICES (WITH SCANS AND SYSTEM COMBINATION FOR POPULATE SIMULATION)
router.get("/", async (req, res) => {
  try {
    const { search, categoryId, status, featured } = req.query;

    // Scan the raw items from DynamoDB
    const servicesResponse = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.SERVICES }),
    );
    let rawServices = servicesResponse.Items || [];

    const categoriesResponse = await dynamoDB.send(
      new ScanCommand({ TableName: TABLES.CATEGORIES }),
    );
    const rawCategories = categoriesResponse.Items || [];

    // Simulate MongoDB Mongoose Populate Logic in Memory
    rawServices = rawServices.map((service) => {
      const matchCat = rawCategories.find(
        (c) => c.categoryId === service.categoryId,
      );
      return {
        ...service,
        id: service.serviceId, // Maps serializer requirements
        category: matchCat ? { ...matchCat, id: matchCat.categoryId } : null,
      };
    });

    // In-Memory Filtration (Equivalent to complex MongoDB filters)
    if (search) {
      const regex = new RegExp(search.trim(), "i");
      rawServices = rawServices.filter(
        (s) => regex.test(s.name) || regex.test(s.description || ""),
      );
    }
    if (categoryId) {
      rawServices = rawServices.filter((s) => s.categoryId === categoryId);
    }
    if (status === "active") {
      rawServices = rawServices.filter((s) => s.active === true);
    } else if (status === "inactive") {
      rawServices = rawServices.filter((s) => s.active === false);
    }
    if (featured !== undefined) {
      const parsedFeat = normalizeBoolean(featured);
      if (parsedFeat !== undefined) {
        rawServices = rawServices.filter((s) => s.featured === parsedFeat);
      }
    }

    // Sort by createdAt desc in memory
    rawServices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    rawCategories.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    res.json({
      services: buildServicesResponse(rawServices),
      stats: buildServiceStats(rawServices),
      categories: rawCategories.map((cat) =>
        buildCategoryPayload({ ...cat, id: cat.categoryId }),
      ),
    });
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch services");
  }
});

// FETCH SINGLE SERVICE BY ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const response = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.SERVICES,
        Key: { serviceId: id },
      }),
    );

    if (!response.Item) {
      return res.status(404).json({ message: "Service not found" });
    }

    let categoryObj = null;
    if (response.Item.categoryId) {
      const catRes = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.CATEGORIES,
          Key: { categoryId: response.Item.categoryId },
        }),
      );
      if (catRes.Item) {
        categoryObj = { ...catRes.Item, id: catRes.Item.categoryId };
      }
    }

    const payloadItem = {
      ...response.Item,
      id: response.Item.serviceId,
      category: categoryObj,
    };

    res.json({ service: buildServicePayload(payloadItem) });
  } catch (error) {
    handleServiceError(res, error, "Failed to fetch service");
  }
});

// CREATE SERVICE
router.post("/", async (req, res) => {
  try {
    const {
      name,
      categoryId,
      description,
      priceMin,
      priceMax,
      durationMinutes,
      benefits,
      featured,
      active,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ message: "Service name is required" });
    }

    const minPrice = parseNumber(priceMin);
    const maxPrice = parseNumber(priceMax);
    const duration = parseNumber(durationMinutes);

    if (minPrice === undefined || maxPrice === undefined) {
      return res
        .status(400)
        .json({ message: "priceMin and priceMax must be valid numbers" });
    }
    if (minPrice < 0 || maxPrice < 0) {
      return res.status(400).json({ message: "Price must be positive" });
    }
    if (maxPrice < minPrice) {
      return res.status(400).json({
        message: "priceMax must be greater than or equal to priceMin",
      });
    }
    if (duration === undefined || duration <= 0) {
      return res
        .status(400)
        .json({ message: "durationMinutes must be a positive number" });
    }

    let categoryItem = null;
    if (categoryId) {
      categoryItem = await ensureCategoryExists(categoryId);
    }

    const serviceId = uuidv4();
    const slug = slugify(name, { lower: true, strict: true }); // Extracted from pre-save hook

    const newService = {
      serviceId,
      name: name.trim(),
      slug,
      categoryId: categoryId || null,
      description: description?.trim() || null,
      priceMin: minPrice,
      priceMax: maxPrice,
      durationMinutes: duration,
      benefits: parseBenefits(benefits),
      featured: normalizeBoolean(featured) ?? false,
      active: normalizeBoolean(active) ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: TABLES.SERVICES,
        Item: newService,
      }),
    );

    const simulatedDoc = {
      ...newService,
      id: serviceId,
      category: categoryItem
        ? { ...categoryItem, id: categoryItem.categoryId }
        : null,
    };

    res.status(201).json({ service: buildServicePayload(simulatedDoc) });
  } catch (error) {
    handleServiceError(res, error, "Failed to create service");
  }
});

// UPDATE SERVICE (PATCH)
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const existingRes = await dynamoDB.send(
      new GetCommand({
        TableName: TABLES.SERVICES,
        Key: { serviceId: id },
      }),
    );

    if (!existingRes.Item) {
      return res.status(404).json({ message: "Service not found" });
    }

    const service = existingRes.Item;
    const body = req.body || {};

    let updateExpressions = ["SET updatedAt = :now"];
    let expressionAttributeValues = { ":now": new Date().toISOString() };

    if (body.name) {
      updateExpressions.push("name = :name, slug = :slug");
      expressionAttributeValues[":name"] = body.name.trim();
      expressionAttributeValues[":slug"] = slugify(body.name, {
        lower: true,
        strict: true,
      });
    }

    if (body.categoryId !== undefined) {
      if (!body.categoryId) {
        updateExpressions.push("categoryId = :catId");
        expressionAttributeValues[":catId"] = null;
      } else {
        await ensureCategoryExists(body.categoryId);
        updateExpressions.push("categoryId = :catId");
        expressionAttributeValues[":catId"] = body.categoryId;
      }
    }

    if (body.description !== undefined) {
      updateExpressions.push("description = :desc");
      expressionAttributeValues[":desc"] = body.description?.trim() || null;
    }

    if (body.priceMin !== undefined || body.priceMax !== undefined) {
      const minPrice = parseNumber(body.priceMin ?? service.priceMin);
      const maxPrice = parseNumber(body.priceMax ?? service.priceMax);

      if (minPrice === undefined || maxPrice === undefined) {
        return res
          .status(400)
          .json({ message: "priceMin and priceMax must be valid numbers" });
      }
      if (minPrice < 0 || maxPrice < 0) {
        return res.status(400).json({ message: "Price must be positive" });
      }
      if (maxPrice < minPrice) {
        return res.status(400).json({
          message: "priceMax must be greater than or equal to priceMin",
        });
      }

      updateExpressions.push("priceMin = :pMin, priceMax = :pMax");
      expressionAttributeValues[":pMin"] = minPrice;
      expressionAttributeValues[":pMax"] = maxPrice;
    }

    if (body.durationMinutes !== undefined) {
      const duration = parseNumber(body.durationMinutes);
      if (duration === undefined || duration <= 0) {
        return res
          .status(400)
          .json({ message: "durationMinutes must be a positive number" });
      }
      updateExpressions.push("durationMinutes = :dur");
      expressionAttributeValues[":dur"] = duration;
    }

    if (body.benefits !== undefined) {
      updateExpressions.push("benefits = :benefits");
      expressionAttributeValues[":benefits"] = parseBenefits(body.benefits);
    }

    if (body.featured !== undefined) {
      const parsed = normalizeBoolean(body.featured);
      if (parsed !== undefined) {
        updateExpressions.push("featured = :feat");
        expressionAttributeValues[":feat"] = parsed;
      }
    }

    if (body.active !== undefined) {
      const parsed = normalizeBoolean(body.active);
      if (parsed !== undefined) {
        updateExpressions.push("active = :act");
        expressionAttributeValues[":act"] = parsed;
      }
    }

    // Fire Update
    await dynamoDB.send(
      new UpdateCommand({
        TableName: TABLES.SERVICES,
        Key: { serviceId: id },
        UpdateExpression: updateExpressions.join(", "),
        ExpressionAttributeValues: expressionAttributeValues,
      }),
    );

    // Re-fetch items back out for full populated presentation responses
    const updatedRes = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.SERVICES, Key: { serviceId: id } }),
    );
    let finalCategory = null;
    if (updatedRes.Item.categoryId) {
      const catCheck = await dynamoDB.send(
        new GetCommand({
          TableName: TABLES.CATEGORIES,
          Key: { categoryId: updatedRes.Item.categoryId },
        }),
      );
      if (catCheck.Item)
        finalCategory = { ...catCheck.Item, id: catCheck.Item.categoryId };
    }

    res.json({
      service: buildServicePayload({
        ...updatedRes.Item,
        id: id,
        category: finalCategory,
      }),
    });
  } catch (error) {
    handleServiceError(res, error, "Failed to update service");
  }
});

// DELETE SERVICE
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const check = await dynamoDB.send(
      new GetCommand({ TableName: TABLES.SERVICES, Key: { serviceId: id } }),
    );
    if (!check.Item) {
      return res.status(404).json({ message: "Service not found" });
    }

    await dynamoDB.send(
      new DeleteCommand({
        TableName: TABLES.SERVICES,
        Key: { serviceId: id },
      }),
    );

    res.json({ message: "Service deleted" });
  } catch (error) {
    handleServiceError(res, error, "Failed to delete service");
  }
});

export default router;

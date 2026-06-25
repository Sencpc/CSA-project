/* eslint-env node */
import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import serverlessExpress from "@codegenie/serverless-express"; // Lambda Wrapper
import authRouter from "./controllers/auth.js";
import usersRouter from "./controllers/users.js";
import couponsRouter from "./controllers/coupons.js";
import bookingsRouter from "./controllers/bookings.js";
import transactionsRouter from "./controllers/transactions.js";
import servicesRouter from "./controllers/services.js";
import customerRouter from "./controllers/customer.js";
import verifyRouter from "./controllers/verify.js";
import settingsRouter from "./controllers/settings.js";
import adminDashboardRouter from "./controllers/adminDashboard.js";
import twilioSmsRouter from "./routes/twilio-sms.js"; // Handled safely

// Load env
dotenv.config();

const app = express();
// const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// // Middlewares
// app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

// Debug middleware - log all requests
app.use((req, res, next) => {
  console.log(
    `[${req.method}] ${req.path} - Query:`,
    req.query,
    "Body:",
    req.body,
  );
  next();
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/coupons", couponsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/customer", customerRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/admin", adminDashboardRouter);
app.use("/api/twilio-sms", twilioSmsRouter); // Preserved

// Health route
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: [${req.method}] ${req.path}`);
  res.status(404).json({
    message: "Route not found",
    path: req.path,
    method: req.method,
  });
});

// ==========================================
//   AWS LAMBDA EXECUTION LOGIC
// ==========================================

let serverlessExpressInstance;

async function bootstrap(event, context) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined");
  }

  // NOTE: MongoDB connect handshakes and cron scanners are completely removed.
  // DynamoDB relies on direct HTTP client calls inside the controllers.

  // Package Express app into Serverless handler format
  serverlessExpressInstance = serverlessExpress({ app });
  return serverlessExpressInstance(event, context);
}

// This is the specific export mapped to 'Handler: server.handler' in template.yaml
export const handler = async (event, context) => {
  // Tells Lambda not to wait for open event loop network elements (like socket hanging)
  context.callbackWaitsForEmptyEventLoop = false;

  // Reuses the instance across warm invocations
  if (serverlessExpressInstance) {
    return serverlessExpressInstance(event, context);
  }

  return bootstrap(event, context);
};

// Traditional server fallback for running locally via node server.js (non-SAM)
if (
  process.env.NODE_ENV !== "production" &&
  !process.env.AWS_LAMBDA_FUNCTION_NAME
) {
  const PORT = process.env.PORT || 4000;
  // Runs immediately without waiting for a database connection pool open string logic link
  app.listen(PORT, () =>
    console.log(`Local dev server listening on http://localhost:${PORT}`),
  );
}

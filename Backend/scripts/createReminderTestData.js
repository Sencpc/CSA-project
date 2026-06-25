import "dotenv/config";
import dayjs from "dayjs";
import { v4 as uuidv4 } from "uuid";
import { PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";

const TEST_USER_EMAIL = "reminder.test@example.com";
const TEST_SERVICE_SLUG = "reminder-test-service";
const TEST_ADMIN_NOTES = "Reminder test booking";

const ensureUser = async () => {
  const scan = await dynamoDB.send(
    new ScanCommand({
      TableName: TABLES.USERS,
      FilterExpression: "email = :email",
      ExpressionAttributeValues: { ":email": TEST_USER_EMAIL },
    }),
  );

  if (scan.Items && scan.Items.length > 0) return scan.Items[0];

  const newUser = {
    id: uuidv4(),
    fullName: "Reminder Test User",
    email: TEST_USER_EMAIL,
    phone: "+628123000111",
    whatsapp: "+628123000111",
    passwordHash:
      "$2a$10$z0Y8iK0Cq9WJYpGQjFzOteS6YVOZ7xP3iY80mB6xG7ZkQG6f7pKzK",
    role: "customer",
    status: "active",
  };
  await dynamoDB.send(
    new PutCommand({ TableName: TABLES.USERS, Item: newUser }),
  );
  return newUser;
};

const ensureService = async () => {
  const scan = await dynamoDB.send(
    new ScanCommand({
      TableName: TABLES.SERVICES,
      FilterExpression: "slug = :slug",
      ExpressionAttributeValues: { ":slug": TEST_SERVICE_SLUG },
    }),
  );

  if (scan.Items && scan.Items.length > 0) return scan.Items[0];

  const newService = {
    serviceId: uuidv4(),
    name: "Reminder Test Service",
    slug: TEST_SERVICE_SLUG,
    priceMin: 100000,
    priceMax: 150000,
    durationMinutes: 60,
    active: true,
  };
  await dynamoDB.send(
    new PutCommand({ TableName: TABLES.SERVICES, Item: newService }),
  );
  return newService;
};

const main = async () => {
  const user = await ensureUser();
  const service = await ensureService();

  const start = dayjs()
    .add(3, "day")
    .hour(10)
    .minute(0)
    .second(0)
    .millisecond(0);
  const end = start.add(service.durationMinutes || 60, "minute");

  // Periksa apakah data booking pengujian ini sudah pernah dimasukkan
  const scanB = await dynamoDB.send(
    new ScanCommand({
      TableName: TABLES.BOOKINGS,
      FilterExpression: "adminNotes = :notes",
      ExpressionAttributeValues: { ":notes": TEST_ADMIN_NOTES },
    }),
  );

  const bookingId = scanB.Items?.[0]?.bookingId || uuidv4();

  const bookingPayload = {
    bookingId,
    user: user.id,
    services: [
      {
        service: service.serviceId,
        name: service.name,
        price: service.priceMin,
        durationMinutes: service.durationMinutes,
      },
    ],
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status: "confirmed",
    slot: { date: start.format("YYYY-MM-DD") },
    payment: { method: "cash", totalAmount: service.priceMin, status: "paid" },
    adminNotes: TEST_ADMIN_NOTES,
    reminders: { threeDay: {} },
  };

  await dynamoDB.send(
    new PutCommand({ TableName: TABLES.BOOKINGS, Item: bookingPayload }),
  );
  console.info(
    "Berhasil membuat data pengujian booking H+3 DynamoDB:",
    bookingId,
  );
  process.exit(0);
};

main().catch((error) => {
  console.error("Gagal menyiapkan data:", error);
  process.exit(1);
});

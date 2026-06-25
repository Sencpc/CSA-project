/* eslint-env node */
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { ScanCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";

dotenv.config();

const addDays = (date, days) =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const toSlotDate = (date) => date.toISOString().split("T")[0];

// Helper untuk membersihkan seluruh isi sebuah tabel DynamoDB
const clearTable = async (tableName, keyName) => {
  try {
    const scanRes = await dynamoDB.send(
      new ScanCommand({ TableName: tableName }),
    );
    const items = scanRes.Items || [];
    for (const item of items) {
      await dynamoDB.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { [keyName]: item[keyName] },
        }),
      );
    }
  } catch (err) {
    console.warn(`Gagal membersihkan tabel ${tableName}:`, err.message);
  }
};

const run = async () => {
  console.log("Seeding database DynamoDB...");

  // 1. Bersihkan seluruh 11 tabel pendukung aplikasi
  await Promise.all([
    clearTable(TABLES.USERS, "id"),
    clearTable(TABLES.CATEGORIES, "categoryId"),
    clearTable(TABLES.SERVICES, "serviceId"),
    clearTable(TABLES.COUPONS, "code"), // Menggunakan code sebagai Partition Key kupon
    clearTable(TABLES.GALLERY_ITEMS, "galleryItemId"),
    clearTable(TABLES.BOOKINGS, "bookingId"),
    clearTable(TABLES.TRANSACTIONS, "transactionId"),
    clearTable(TABLES.REVIEWS, "reviewId"),
    clearTable(TABLES.NOTIFICATIONS, "notificationId"),
    clearTable(TABLES.BLOG_POSTS, "blogPostId"),
    clearTable(TABLES.SETTINGS, "settingId"),
  ]);

  const [adminPassword, stylistPassword, customerPassword] = await Promise.all([
    bcrypt.hash("Admin@123", 10),
    bcrypt.hash("Stylist@123", 10),
    bcrypt.hash("Customer@123", 10),
  ]);

  // 2. Seed Data Users
  const rawUsers = [
    {
      id: uuidv4(),
      fullName: "Admin",
      email: "admin@example.com",
      phone: "0800000000",
      passwordHash: adminPassword,
      role: "admin",
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      fullName: "Sari Stylist",
      email: "sari@example.com",
      phone: "081200000001",
      passwordHash: stylistPassword,
      role: "admin",
      staffProfile: {
        bio: "Senior stylist dengan pengalaman 8 tahun",
        skills: ["Haircut", "Coloring"],
        specialties: ["Bob cut", "Layered"],
        availability: [
          { dayOfWeek: 1, start: "09:00", end: "17:00" },
          { dayOfWeek: 3, start: "09:00", end: "17:00" },
          { dayOfWeek: 5, start: "09:00", end: "17:00" },
        ],
        commissionRate: 10,
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      fullName: "Andi Pratama",
      email: "andi@example.com",
      phone: "081200000002",
      passwordHash: customerPassword,
      role: "customer",
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      fullName: "Bella Sari",
      email: "bella@example.com",
      phone: "081200000003",
      passwordHash: customerPassword,
      role: "customer",
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      fullName: "Carla Putri",
      email: "carla@example.com",
      phone: "081200000004",
      passwordHash: customerPassword,
      role: "customer",
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      fullName: "Dimas Rangga",
      email: "dimas@example.com",
      phone: "081200000005",
      passwordHash: customerPassword,
      role: "customer",
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      fullName: "Eka Lestari",
      email: "eka@example.com",
      phone: "081200000006",
      passwordHash: customerPassword,
      role: "customer",
      createdAt: new Date().toISOString(),
    },
  ];

  for (const user of rawUsers) {
    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.USERS, Item: user }),
    );
  }

  const stylistUser = rawUsers[1];
  const customerAndi = rawUsers[2];
  const customerBella = rawUsers[3];
  const customerCarla = rawUsers[4];
  const customerDimas = rawUsers[5];
  const customerEka = rawUsers[6];

  // 3. Seed Data Categories
  const rawCategories = [
    {
      categoryId: uuidv4(),
      name: "Haircut",
      description: "Layanan potong rambut",
    },
    {
      categoryId: uuidv4(),
      name: "Coloring",
      description: "Pilihan warna dan highlight rambut",
    },
    {
      categoryId: uuidv4(),
      name: "Treatment",
      description: "Perawatan rambut dan kulit",
    },
    {
      categoryId: uuidv4(),
      name: "Styling",
      description: "Penataan rambut profesional",
    },
    {
      categoryId: uuidv4(),
      name: "Makeup",
      description: "Layanan makeup untuk berbagai acara",
    },
  ];

  for (const cat of rawCategories) {
    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.CATEGORIES, Item: cat }),
    );
  }

  const categoryByName = Object.fromEntries(
    rawCategories.map((c) => [c.name, c]),
  );

  // 4. Seed Data Services
  const rawServices = [
    {
      serviceId: uuidv4(),
      name: "Cutting",
      categoryId: categoryByName.Haircut.categoryId,
      description: "Potong rambut profesional untuk tampilan fresh",
      priceMin: 50000,
      priceMax: 50000,
      durationMinutes: 45,
      benefits: ["Tampilan rapi", "Konsultasi gaya rambut", "Styling gratis"],
      featured: true,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      serviceId: uuidv4(),
      name: "Creambath",
      categoryId: categoryByName.Treatment.categoryId,
      description: "Perawatan rambut dengan krim nutrisi",
      priceMin: 75000,
      priceMax: 75000,
      durationMinutes: 60,
      benefits: [
        "Rambut lebih lembut",
        "Mengatasi rambut kering",
        "Relaksasi kepala",
      ],
      featured: false,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      serviceId: uuidv4(),
      name: "Hair Spa",
      categoryId: categoryByName.Treatment.categoryId,
      description: "Perawatan spa untuk rambut sehat berkilau",
      priceMin: 85000,
      priceMax: 85000,
      durationMinutes: 75,
      benefits: [
        "Nutrisi mendalam",
        "Rambut lebih sehat",
        "Mengurangi kerontokan",
      ],
      featured: true,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      serviceId: uuidv4(),
      name: "Hair Mask",
      categoryId: categoryByName.Treatment.categoryId,
      description: "Masker rambut untuk perawatan intensif",
      priceMin: 80000,
      priceMax: 80000,
      durationMinutes: 50,
      benefits: [
        "Rambut lebih halus",
        "Mengatasi rambut rusak",
        "Aroma menenangkan",
      ],
      featured: false,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      serviceId: uuidv4(),
      name: "Pelurusan",
      categoryId: categoryByName.Styling.categoryId,
      description: "Pelurusan rambut permanen untuk tampilan sleek",
      priceMin: 150000,
      priceMax: 150000,
      durationMinutes: 120,
      benefits: ["Rambut lurus natural", "Tahan lama", "Mudah diatur"],
      featured: true,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      serviceId: uuidv4(),
      name: "Pewarnaan",
      categoryId: categoryByName.Coloring.categoryId,
      description: "Pewarnaan rambut dengan produk berkualitas",
      priceMin: 125000,
      priceMax: 125000,
      durationMinutes: 90,
      benefits: ["Warna cerah natural", "Tidak merusak rambut", "Tahan lama"],
      featured: true,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      serviceId: uuidv4(),
      name: "Facial",
      categoryId: categoryByName.Treatment.categoryId,
      description: "Perawatan wajah untuk kulit bercahaya",
      priceMin: 125000,
      priceMax: 125000,
      durationMinutes: 60,
      benefits: ["Kulit lebih cerah", "Pori-pori bersih", "Wajah fresh"],
      featured: true,
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      serviceId: uuidv4(),
      name: "Body Spa",
      categoryId: categoryByName.Treatment.categoryId,
      description: "Spa tubuh lengkap untuk perawatan menyeluruh",
      priceMin: 125000,
      priceMax: 125000,
      durationMinutes: 90,
      benefits: [
        "Perawatan menyeluruh",
        "Kulit lebih sehat",
        "Relaksasi maksimal",
      ],
      featured: true,
      active: true,
      createdAt: new Date().toISOString(),
    },
  ];

  for (const srv of rawServices) {
    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.SERVICES, Item: srv }),
    );
  }

  const serviceByName = Object.fromEntries(rawServices.map((s) => [s.name, s]));

  // 5. Seed Data Settings
  await dynamoDB.send(
    new PutCommand({
      TableName: TABLES.SETTINGS,
      Item: {
        settingId: "global_configuration",
        general: {
          businessName: "Flower Beauty Salon",
          address: "Jl. Mawar No. 1, Jakarta",
          phone: "+62-812-0000-0000",
          email: "contact@flowerbeauty.com",
          social: { instagram: "flowerbeauty" },
          hours: [{ day: "Senin-Jumat", open: "09:00", close: "18:00" }],
        },
        booking: {
          dpType: "percent",
          dpAmount: 20,
          leadTimeDays: 1,
          slotDurationMinutes: 30,
        },
      },
    }),
  );

  const now = new Date();

  // 6. Seed Data Coupons
  const rawCoupons = [
    {
      code: "WELCOME20",
      description: "Diskon 20% untuk pelanggan baru",
      discountType: "percent",
      amount: 20,
      minSpend: 150000,
      startDate: addDays(now, -7).toISOString(),
      endDate: addDays(now, 60).toISOString(),
      usageLimit: 200,
      categoryIds: [categoryByName.Haircut.categoryId],
      isActive: true,
    },
    {
      code: "GLOWUP50",
      description: "Potongan Rp50.000 untuk perawatan wajah",
      discountType: "fixed",
      amount: 50000,
      minSpend: 100000,
      startDate: addDays(now, -3).toISOString(),
      endDate: addDays(now, 45).toISOString(),
      usageLimit: 150,
      serviceIds: [serviceByName["Facial"].serviceId],
      isActive: true,
    },
  ];

  for (const cp of rawCoupons) {
    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.COUPONS, Item: cp }),
    );
  }

  // 7. Seed Data Bookings
  const buildBookingItem = ({
    customer,
    servicesSelected,
    offsetDays,
    hour,
    minute = 0,
    status = "pending",
    paymentStatus = "pending",
  }) => {
    const base = new Date();
    const startTime = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + offsetDays,
      hour,
      minute,
    );
    let totalDuration = 0;
    const servicesPayload = servicesSelected.map(({ service, price }) => {
      totalDuration += service.durationMinutes;
      return {
        service: service.serviceId,
        name: service.name,
        price,
        durationMinutes: service.durationMinutes,
      };
    });

    const totalAmount = servicesSelected.reduce(
      (sum, item) => sum + item.price,
      0,
    );
    const endTime = new Date(startTime.getTime() + totalDuration * 60000);

    return {
      bookingId: uuidv4(),
      user: customer.id,
      services: servicesPayload,
      stylist: stylistUser.id,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status,
      slot: { date: toSlotDate(startTime) },
      payment: {
        method: "e-wallet",
        dpAmount: Math.round(totalAmount * 0.2),
        totalAmount,
        status: paymentStatus,
        invoiceNo: `INV-${startTime.getTime()}`,
        reference: `PAY-${startTime.getTime()}`,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const bookingSeeds = [
    buildBookingItem({
      customer: customerAndi,
      servicesSelected: [{ service: serviceByName["Cutting"], price: 50000 }],
      offsetDays: 1,
      hour: 10,
      status: "confirmed",
      paymentStatus: "paid",
    }),
    buildBookingItem({
      customer: customerBella,
      servicesSelected: [
        { service: serviceByName["Pewarnaan"], price: 125000 },
      ],
      offsetDays: 2,
      hour: 14,
      status: "pending",
      paymentStatus: "pending",
    }),
  ];

  for (const b of bookingSeeds) {
    await dynamoDB.send(
      new PutCommand({ TableName: TABLES.BOOKINGS, Item: b }),
    );
  }

  console.log("Seeding DynamoDB completed.");
  console.log("Admin: admin@example.com / Admin@123");
};

run().catch((e) => {
  console.error("Seeding failed:", e);
  process.exit(1);
});

import express from "express";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDB, TABLES } from "../config/dynamo.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();

router.use(authenticate);
router.use(authorizeRoles("admin"));

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const parseYear = (value) => {
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year)) return null;
  if (year < 2000 || year > 2100) return null;
  return year;
};

const parseMonth = (value) => {
  const month = Number.parseInt(value, 10);
  if (!Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return month;
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const safeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const requestedYear = parseYear(req.query.year);
    const requestedMonth = parseMonth(req.query.month);
    const year = requestedYear ?? now.getFullYear();
    const monthIndex = (requestedMonth ?? now.getMonth() + 1) - 1;

    const startOfYearTime = new Date(year, 0, 1).getTime();
    const endOfYearTime = new Date(year + 1, 0, 1).getTime();
    const startOfMonthTime = new Date(year, monthIndex, 1).getTime();
    const endOfMonthTime = new Date(year, monthIndex + 1, 1).getTime();

    const todayStart = startOfDay(now);
    const todayKey = todayStart.toISOString().slice(0, 10);
    const sevenDaysOutTime = now.getTime() + 7 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgoTime = now.getTime() - 90 * 24 * 60 * 60 * 1000;
    const tomorrowStartEndTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    ).getTime();

    // Pull database data tables via full parallel scans
    const [usersRes, bookingsRes, couponsRes, transactionsRes] =
      await Promise.all([
        dynamoDB.send(new ScanCommand({ TableName: TABLES.USERS })),
        dynamoDB.send(new ScanCommand({ TableName: TABLES.BOOKINGS })),
        dynamoDB.send(new ScanCommand({ TableName: TABLES.COUPONS })),
        dynamoDB.send(new ScanCommand({ TableName: TABLES.TRANSACTIONS })),
      ]);

    const allUsers = usersRes.Items || [];
    const allBookings = bookingsRes.Items || [];
    const allCoupons = couponsRes.Items || [];
    const allTransactions = transactionsRes.Items || [];

    // 1. Core Simple Metrics Counter
    const activeUsers = allUsers.filter(
      (u) => u.status === "active" && u.role === "customer",
    ).length;
    const activeAdmins = allUsers.filter(
      (u) => u.status === "active" && u.role === "admin",
    ).length;

    const nowStr = now.toISOString();
    const activeCoupons = allCoupons.filter((c) => {
      if (!c.isActive) return false;
      if (c.startDate && c.startDate > nowStr) return false;
      if (c.endDate && c.endDate < nowStr) return false;
      return true;
    }).length;

    const expiringCoupons = allCoupons.filter((c) => {
      return (
        c.isActive &&
        c.endDate &&
        c.endDate >= nowStr &&
        new Date(c.endDate).getTime() <= sevenDaysOutTime
      );
    }).length;

    const bookingPending = allBookings.filter((b) =>
      ["pending", "confirmed", "in-progress"].includes(b.status),
    ).length;
    const bookingCompletedToday = allBookings.filter(
      (b) => b.status === "completed" && b.slot?.date === todayKey,
    ).length;
    const bookingCancelledToday = allBookings.filter(
      (b) => b.status === "cancelled" && b.slot?.date === todayKey,
    ).length;

    const newCustomers = allUsers.filter((u) => {
      if (u.role !== "customer" || !u.createdAt) return false;
      const t = new Date(u.createdAt).getTime();
      return t >= startOfMonthTime && t < endOfMonthTime;
    }).length;

    // 2. In-Memory Processing: Annual Monthly Revenue Data Array
    const monthlyRevenueMap = Array.from({ length: 12 }, (_, i) => ({
      month: MONTH_LABELS[i],
      revenue: 0,
      discount: 0,
      net: 0,
    }));

    // 3. In-Memory Processing: Current Month Variables
    let grossMonth = 0;
    let discountMonth = 0;
    let netMonth = 0;
    let monthTransactions = 0;

    // 4. In-Memory Processing: Weekly Breakdown Array Map
    const weeklyRevenueMap = {}; // Tracks structural weeks {1: {gross, discount, net}}

    // 5. In-Memory Processing: Top Service Array Map counter
    const servicePopularityMap = {};

    allTransactions.forEach((tx) => {
      if (tx.status !== "paid" || !tx.updatedAt) return;
      const txTime = new Date(tx.updatedAt).getTime();
      const grossVal = safeNumber(tx.metadata?.subtotal ?? tx.grossAmount);
      const discountVal = safeNumber(tx.metadata?.discountAmount ?? 0);
      const netVal = safeNumber(tx.amount);

      // Populate Annual Array
      if (txTime >= startOfYearTime && txTime < endOfYearTime) {
        const txMonth = new Date(tx.updatedAt).getMonth(); // 0-11
        monthlyRevenueMap[txMonth].revenue += grossVal;
        monthlyRevenueMap[txMonth].discount += discountVal;
        monthlyRevenueMap[txMonth].net += netVal;
      }

      // Populate Monthly Metrics & Weekly Breakdowns & Service Unwinds
      if (txTime >= startOfMonthTime && txTime < endOfMonthTime) {
        grossMonth += grossVal;
        discountMonth += discountVal;
        netMonth += netVal;
        monthTransactions++;

        // Weekly Calculation Math logic
        const dayOfMonth = new Date(tx.updatedAt).getDate();
        const weekIndex = Math.floor((dayOfMonth - 1) / 7) + 1;
        if (!weeklyRevenueMap[weekIndex])
          weeklyRevenueMap[weekIndex] = { gross: 0, discount: 0, net: 0 };
        weeklyRevenueMap[weekIndex].gross += grossVal;
        weeklyRevenueMap[weekIndex].discount += discountVal;
        weeklyRevenueMap[weekIndex].net += netVal;

        // Service Popularity Map (MongoDB unwind simulation)
        if (Array.isArray(tx.bookedServices)) {
          tx.bookedServices.forEach((svc) => {
            if (svc.name) {
              servicePopularityMap[svc.name] =
                (servicePopularityMap[svc.name] || 0) + 1;
            }
          });
        }
      }
    });

    const monthlyRevenueData = monthlyRevenueMap;
    const discountRate = grossMonth > 0 ? discountMonth / grossMonth : 0;
    const avgPerBooking =
      monthTransactions > 0 ? netMonth / monthTransactions : 0;

    const weeklyRevenueData = Object.keys(weeklyRevenueMap)
      .map((wk) => ({
        week: `Week ${wk}`,
        revenue: weeklyRevenueMap[wk].gross,
        discount: weeklyRevenueMap[wk].discount,
        net: weeklyRevenueMap[wk].net,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    const servicePopularity = Object.keys(servicePopularityMap)
      .map((name) => ({
        name,
        count: servicePopularityMap[name],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const mostPopularService = servicePopularity[0]?.name ?? null;

    // 6. Peak Day Calculation (MongoDB aggregate project mapping)
    const dayOfWeekCounter = {};
    allBookings.forEach((b) => {
      if (b.status === "cancelled" || !b.startTime) return;
      const bTime = new Date(b.startTime).getTime();
      if (bTime >= startOfMonthTime && bTime < endOfMonthTime) {
        const dayNum = new Date(b.startTime).getDay() + 1; // Maps JS 0-6 to MongoDB 1-7
        dayOfWeekCounter[dayNum] = (dayOfWeekCounter[dayNum] || 0) + 1;
      }
    });

    const dayNameMap = {
      1: "Sunday",
      2: "Monday",
      3: "Tuesday",
      4: "Wednesday",
      5: "Thursday",
      6: "Friday",
      7: "Saturday",
    };
    const peakDayIndex = Object.keys(dayOfWeekCounter).sort(
      (a, b) => dayOfWeekCounter[b] - dayOfWeekCounter[a],
    )[0];
    const peakDay = peakDayIndex ? dayNameMap[peakDayIndex] : null;

    // 7. Retention Analysis (90-day window transaction counts processing)
    const userBookingCountMap = {};
    allBookings.forEach((b) => {
      if (!b.startTime || !b.user) return;
      const bTime = new Date(b.startTime).getTime();
      if (bTime >= ninetyDaysAgoTime && bTime < tomorrowStartEndTime) {
        userBookingCountMap[b.user] = (userBookingCountMap[b.user] || 0) + 1;
      }
    });

    const customerIdsArr = Object.keys(userBookingCountMap);
    const totalRetentionCustomers = customerIdsArr.length;
    const repeatCustomersCount = customerIdsArr.filter(
      (uid) => userBookingCountMap[uid] >= 2,
    ).length;
    const retentionPercent =
      totalRetentionCustomers > 0
        ? (repeatCustomersCount / totalRetentionCustomers) * 100
        : 0;

    res.json({
      year,
      month: monthIndex + 1,
      stats: {
        activeUsers,
        activeCoupons,
        expiringCoupons,
        revenueMonthly: {
          gross: grossMonth,
          discount: discountMonth,
          net: netMonth,
          transactions: monthTransactions,
          discountRate,
          avgPerBooking,
        },
        quickStats: {
          pendingBookings: bookingPending,
          completedToday: bookingCompletedToday,
          newCustomers,
          cancelledToday: bookingCancelledToday,
        },
        insights: {
          mostPopularService,
          peakDay,
          activeAdmins,
          customerRetentionPercent: retentionPercent,
        },
        servicePopularity,
      },
      series: {
        monthlyRevenueData,
        weeklyRevenueData,
      },
    });
  } catch (error) {
    console.error("Failed to build dashboard metrics", error);
    res.status(500).json({ message: "Failed to build dashboard metrics" });
  }
});

export default router;

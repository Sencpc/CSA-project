import { useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { Card, Col, Row, Statistic, Typography } from "antd";
import {
  DollarOutlined,
  PercentageOutlined,
  TeamOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/env.js";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const Dashboard = () => {
  const { token } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Failed to load dashboard");
        }

        const data = await response.json();
        if (!cancelled) {
          setDashboard(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Failed to load dashboard");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(value ?? 0));

  const million = (value) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    return numeric / 1_000_000;
  };

  const stats = dashboard?.stats;
  const series = dashboard?.series;

  const monthlyRevenueData = Array.isArray(series?.monthlyRevenueData)
    ? series.monthlyRevenueData
    : [];
  const weeklyRevenueData = Array.isArray(series?.weeklyRevenueData)
    ? series.weeklyRevenueData
    : [];

  const serviceData = useMemo(() => {
    const palette = [
      "#EF4444",
      "#F59E0B",
      "#10B981",
      "#3B82F6",
      "#8B5CF6",
      "#EC4899",
      "#06B6D4",
      "#84CC16",
    ];

    const raw = Array.isArray(stats?.servicePopularity)
      ? stats.servicePopularity
      : [];

    const total = raw.reduce((acc, entry) => acc + Number(entry?.count ?? 0), 0);
    if (total <= 0) return [];

    return raw
      .slice(0, 8)
      .map((entry, index) => ({
        name: entry?.name || "Service",
        value: Number(entry?.count ?? 0),
        color: palette[index % palette.length],
      }))
      .filter((entry) => entry.value > 0);
  }, [stats?.servicePopularity]);

  const monthLabel = useMemo(() => {
    const year = dashboard?.year;
    const month = dashboard?.month;
    if (!year || !month) return "Current Month";
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString("en-US", { month: "long", year: "numeric" });
  }, [dashboard?.year, dashboard?.month]);

  const revenueMonthly = stats?.revenueMonthly;
  const insight = stats?.insights;

  return (
    <AdminLayout title="Dashboard">
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading}>
              <Statistic
                title="Active Users"
                value={stats?.activeUsers ?? 0}
                prefix={<TeamOutlined />}
                suffix={
                  error ? (
                    <Typography.Text type="danger">(error)</Typography.Text>
                  ) : null
                }
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading}>
              <Statistic
                title="Active Coupons"
                value={stats?.activeCoupons ?? 0}
                prefix={<TagOutlined />}
                suffix={
                  <Typography.Text type="secondary">
                    ({stats?.expiringCoupons ?? 0} expiring)
                  </Typography.Text>
                }
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading}>
              <Statistic
                title="Revenue (Monthly)"
                value={million(revenueMonthly?.net)}
                precision={1}
                prefix={<DollarOutlined />}
                suffix="M"
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loading}>
              <Statistic
                title="Discount (Monthly)"
                value={million(revenueMonthly?.discount)}
                precision={2}
                prefix={<PercentageOutlined />}
                suffix="M"
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title="Monthly Revenue Trend"
              extra={
                <Typography.Text type="secondary">
                  Revenue vs Discount vs Net Revenue ({dashboard?.year ?? "—"})
                </Typography.Text>
              }
              loading={loading}
            >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => `${value / 1000000}M`} />
                <Tooltip
                  formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #ccc",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  name="Gross Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="discount"
                  stroke="#EF4444"
                  strokeWidth={2}
                  name="Coupon Discount"
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Net Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title="Weekly Revenue Breakdown"
              extra={
                <Typography.Text type="secondary">
                  {monthLabel} - Weekly Performance
                </Typography.Text>
              }
              loading={loading}
            >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis tickFormatter={(value) => `${value / 1000000}M`} />
                <Tooltip
                  formatter={(value) => `Rp ${(value / 1000000).toFixed(2)}M`}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #ccc",
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#3B82F6" name="Gross Revenue" />
                <Bar dataKey="discount" fill="#F59E0B" name="Coupon Discount" />
                <Bar dataKey="net" fill="#10B981" name="Net Revenue" />
              </BarChart>
            </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* Bottom Row - Service Popularity & Revenue Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Service Popularity Pie Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Service Popularity
              </h3>
              <p className="text-sm text-gray-500">
                Distribution by service type
              </p>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={serviceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {serviceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Revenue Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6 lg:col-span-2">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Revenue Summary
              </h3>
              <p className="text-sm text-gray-500">
                Detailed breakdown of current month
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">
                    Gross Revenue ({monthLabel})
                  </p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(revenueMonthly?.gross)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Bookings</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {revenueMonthly?.transactions ?? 0}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Coupon Discounts</p>
                  <p className="text-2xl font-bold text-red-600">
                    - {formatCurrency(revenueMonthly?.discount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Discount Rate</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {`${((revenueMonthly?.discountRate ?? 0) * 100).toFixed(0)}%`}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-200">
                <div>
                  <p className="text-sm text-gray-600">Net Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(revenueMonthly?.net)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Avg per Booking</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatCurrency(revenueMonthly?.avgPerBooking)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-600">Most Popular Service</p>
                  <p className="text-lg font-bold text-blue-600">
                    {stats?.insights?.mostPopularService || "—"}
                  </p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-gray-600">Peak Day</p>
                  <p className="text-lg font-bold text-yellow-600">
                    {insight?.peakDay || "—"}
                  </p>
                </div>
                <div className="p-3 bg-pink-50 rounded-lg">
                  <p className="text-xs text-gray-600">Active Admin</p>
                  <p className="text-lg font-bold text-pink-600">
                    {insight?.activeAdmins ?? 0} Members
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg">
                  <p className="text-xs text-gray-600">Customer Retention</p>
                  <p className="text-lg font-bold text-indigo-600">
                    {`${Number(insight?.customerRetentionPercent ?? 0).toFixed(0)}%`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">
                  Pending Bookings
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.quickStats?.pendingBookings ?? 0}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">
                  Completed Today
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.quickStats?.completedToday ?? 0}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">New Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.quickStats?.newCustomers ?? 0}
                </p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <svg
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase">Cancelled</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats?.quickStats?.cancelledToday ?? 0}
                </p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;

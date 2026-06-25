import { useEffect, useMemo, useState } from "react";
import CustomerDashboardLayout from "./CustomerDashboardLayout";
import { useAuth } from "../../../context/AuthContext";

import {
  Alert,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";

import { API_BASE_URL } from "../../../config/env.js";

const initialStats = {
  totalBookings: 0,
  activeBookings: 0,
  completedServices: 0,
};

const STATUS_TAG_COLOR = {
  pending: "gold",
  confirmed: "blue",
  "in-progress": "purple",
  completed: "green",
  cancelled: "red",
};

const formatCurrency = (value) => {
  if (typeof value !== "number") {
    return "Rp 0";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const CustomerDashboard = () => {
  const { token, initializing } = useAuth();
  const [stats, setStats] = useState(initialStats);
  const [recentBookings, setRecentBookings] = useState([]);
  const [upcomingBooking, setUpcomingBooking] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (initializing || !token) {
      return;
    }

    const controller = new AbortController();

    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_BASE_URL}/api/customer/dashboard`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Failed to load dashboard");
        }

        const payload = await response.json();

        setStats({
          totalBookings: payload?.stats?.totalBookings ?? 0,
          activeBookings: payload?.stats?.activeBookings ?? 0,
          completedServices: payload?.stats?.completedServices ?? 0,
        });

        setRecentBookings(
          Array.isArray(payload?.recentBookings) ? payload.recentBookings : []
        );

        setUpcomingBooking(payload?.upcomingBooking ?? null);
      } catch (fetchError) {
        if (fetchError.name === "AbortError") {
          return;
        }
        console.error("Failed to load customer dashboard", fetchError);
        setError(fetchError.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();

    return () => controller.abort();
  }, [initializing, token]);

  const upcomingServiceName = useMemo(() => {
    if (!upcomingBooking?.services?.length) {
      return null;
    }
    const names = upcomingBooking.services
      .map((service) => service?.name)
      .filter(Boolean);
    if (names.length === 0) {
      return null;
    }
    if (names.length === 1) {
      return names[0];
    }
    const [first, second] = names;
    return `${first}${second ? ` & ${second}` : ""}`;
  }, [upcomingBooking]);

  const recentRows = useMemo(() => {
    return (Array.isArray(recentBookings) ? recentBookings : []).map(
      (booking, index) => {
        const serviceNames = booking.services
          ?.map((service) => service?.name)
          .filter(Boolean);
        const displayService =
          serviceNames && serviceNames.length > 0
            ? serviceNames.join(", ")
            : "Service";

        const totalAmount =
          booking.payment?.totalAmount ??
          booking.services?.reduce(
            (sum, service) => sum + (service?.price ?? 0),
            0
          ) ??
          0;

        const bookingKey = (() => {
          if (typeof booking.id === "string") return booking.id;
          if (booking.id && typeof booking.id === "object") {
            return booking.id.toString?.() ?? JSON.stringify(booking.id);
          }
          if (typeof booking._id === "string") return booking._id;
          if (booking._id && typeof booking._id === "object") {
            return booking._id.toString?.() ?? JSON.stringify(booking._id);
          }
          return `${displayService}-${booking.startTime ?? "unknown"}-${index}`;
        })();

        return {
          key: bookingKey,
          service: displayService,
          date: booking.startTime,
          status: booking.status,
          price: totalAmount,
        };
      }
    );
  }, [recentBookings]);

  const columns = useMemo(
    () => [
      {
        title: "Service",
        dataIndex: "service",
        key: "service",
        ellipsis: true,
        render: (value) => (
          <Typography.Text strong>{value || "Service"}</Typography.Text>
        ),
      },
      {
        title: "Date",
        dataIndex: "date",
        key: "date",
        render: (value) => (
          <Typography.Text type="secondary">{formatDate(value)}</Typography.Text>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (value) => {
          const normalized = (value || "pending").toString();
          return (
            <Tag color={STATUS_TAG_COLOR[normalized] || "default"}>
              {normalized.replace(/-/g, " ")}
            </Tag>
          );
        },
      },
      {
        title: "Price",
        dataIndex: "price",
        key: "price",
        align: "right",
        render: (value) => (
          <Typography.Text>{formatCurrency(value ?? 0)}</Typography.Text>
        ),
      },
    ],
    []
  );

  return (
    <CustomerDashboardLayout title="Dashboard">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {error && (
          <Alert
            type="error"
            showIcon
            message="Failed to load dashboard"
            description={error}
          />
        )}

        {upcomingBooking && (
          <Alert
            type="info"
            showIcon
            message="Upcoming Appointment"
            description={
              <Space wrap size="middle">
                <Typography.Text strong>
                  {formatDate(upcomingBooking.startTime)}
                </Typography.Text>
                {upcomingServiceName && (
                  <Typography.Text>{upcomingServiceName}</Typography.Text>
                )}
                <Tag
                  color={
                    STATUS_TAG_COLOR[upcomingBooking.status] || "default"
                  }
                >
                  {(upcomingBooking.status || "pending").replace(/-/g, " ")}
                </Tag>
              </Space>
            }
          />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={8}>
            <Card>
              <Statistic
                title="Total Bookings"
                value={stats.totalBookings}
                prefix={<CalendarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Card>
              <Statistic
                title="Active Bookings"
                value={stats.activeBookings}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} lg={8}>
            <Card>
              <Statistic
                title="Completed Services"
                value={stats.completedServices}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card title="Recent Activity">
          <Table
            columns={columns}
            dataSource={recentRows}
            loading={loading}
            pagination={false}
            locale={{
              emptyText: token
                ? "No bookings found yet. Book a service to see it here."
                : "Sign in to view your bookings.",
            }}
          />
        </Card>
      </Space>
    </CustomerDashboardLayout>
  );
};

export default CustomerDashboard;

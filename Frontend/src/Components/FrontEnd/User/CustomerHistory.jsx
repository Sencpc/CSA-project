import { useCallback, useEffect, useMemo, useState } from "react";
import CustomerDashboardLayout from "./CustomerDashboardLayout";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/env.js";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  List,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  UserOutlined,
} from "@ant-design/icons";

const DEFAULT_PAGE_SIZE = 10;
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "in-progress"];

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formatCurrency = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return currencyFormatter.format(0);
  }
  return currencyFormatter.format(value);
};

const formatDate = (value) => {
  if (!value) {
    return "Unknown date";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return dateFormatter.format(date);
};

const formatTime = (value) => {
  if (!value) {
    return "Unknown time";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return timeFormatter.format(date);
};

const summarizeServices = (services) => {
  if (!Array.isArray(services) || services.length === 0) {
    return "Selected services";
  }
  const names = services
    .map((entry) => entry?.name || entry?.service?.name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);
  if (names.length === 0) {
    return "Selected services";
  }
  return names.join(", ");
};

const resolveTotalAmount = (booking) => {
  if (booking?.payment && typeof booking.payment.totalAmount === "number") {
    return booking.payment.totalAmount;
  }
  if (Array.isArray(booking?.services)) {
    return booking.services.reduce((total, item) => {
      const value = typeof item?.price === "number" ? item.price : 0;
      return total + value;
    }, 0);
  }
  return 0;
};

const toTitle = (value) => {
  if (!value) {
    return "Status";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const determineStatusKey = (booking, nowTimestamp) => {
  const status = booking?.status;
  if (!status) {
    return "pending";
  }
  if (status === "completed") {
    return "completed";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  if (ACTIVE_BOOKING_STATUSES.includes(status)) {
    const startTime = booking?.startTime ? new Date(booking.startTime) : null;
    const startTimestamp = startTime ? startTime.getTime() : NaN;
    if (!Number.isNaN(startTimestamp) && startTimestamp >= nowTimestamp) {
      return "upcoming";
    }
    return "upcoming";
  }
  return status;
};

const statusConfig = {
  upcoming: {
    label: "Upcoming",
    tagColor: "blue",
    icon: <CalendarOutlined />,
  },
  completed: {
    label: "Completed",
    tagColor: "green",
    icon: <CheckCircleOutlined />,
  },
  cancelled: {
    label: "Cancelled",
    tagColor: "red",
    icon: <CloseCircleOutlined />,
  },
};

const CustomerHistory = () => {
  const { token, initializing } = useAuth();
  const [filterStatus, setFilterStatus] = useState("All");
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    upcoming: 0,
    completed: 0,
    cancelled: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const normalizedFilter = filterStatus.toLowerCase();

  const filterOptions = useMemo(
    () => [
      { label: "All", value: "All", count: stats.total },
      { label: "Upcoming", value: "Upcoming", count: stats.upcoming },
      { label: "Completed", value: "Completed", count: stats.completed },
      { label: "Cancelled", value: "Cancelled", count: stats.cancelled },
    ],
    [stats]
  );

  const fetchBookings = useCallback(
    async (currentPage, currentFilter, signal) => {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", DEFAULT_PAGE_SIZE.toString());

      if (currentFilter && currentFilter !== "all") {
        params.set("status", currentFilter);
      }

      const response = await fetch(
        `${API_BASE_URL}/api/customer/bookings?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal,
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.message || "Failed to load booking history";
        const errorInstance = new Error(message);
        errorInstance.status = response.status;
        throw errorInstance;
      }

      return response.json();
    },
    [token]
  );

  useEffect(() => {
    setPage(1);
    setBookings([]);
  }, [normalizedFilter]);

  useEffect(() => {
    if (initializing || !token) {
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadBookings = async () => {
      try {
        setLoading(true);
        setError("");

        const payload = await fetchBookings(
          page,
          normalizedFilter,
          controller.signal
        );

        if (isCancelled) {
          return;
        }

        const nextBookings = Array.isArray(payload?.bookings)
          ? payload.bookings
          : [];

        setBookings((previous) =>
          page === 1 ? nextBookings : [...previous, ...nextBookings]
        );

        setStats({
          total: payload?.stats?.total ?? 0,
          upcoming: payload?.stats?.upcoming ?? 0,
          completed: payload?.stats?.completed ?? 0,
          cancelled: payload?.stats?.cancelled ?? 0,
        });

        setPagination({
          page: payload?.pagination?.page ?? page,
          limit: payload?.pagination?.limit ?? DEFAULT_PAGE_SIZE,
          total: payload?.pagination?.total ?? nextBookings.length,
          totalPages: payload?.pagination?.totalPages ?? 0,
          hasNextPage: Boolean(payload?.pagination?.hasNextPage),
          hasPreviousPage: Boolean(payload?.pagination?.hasPreviousPage),
        });
      } catch (err) {
        if (isCancelled || err.name === "AbortError") {
          return;
        }
        console.error("Failed to load booking history", err);
        setError(err.message || "Failed to load booking history");
        if (page === 1) {
          setBookings([]);
          setStats({ total: 0, upcoming: 0, completed: 0, cancelled: 0 });
          setPagination((previous) => ({
            ...previous,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          }));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadBookings();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [initializing, token, normalizedFilter, page, fetchBookings]);

  const handleFilterChange = (nextStatus) => {
    if (nextStatus === filterStatus) {
      return;
    }
    setFilterStatus(nextStatus);
  };

  const handleLoadMore = () => {
    if (pagination.hasNextPage && !loading) {
      setPage((prev) => prev + 1);
    }
  };

  const nowTimestamp = Date.now();

  const totalBookingsCount = stats.total;

  return (
    <CustomerDashboardLayout title="Booking History">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} lg={6}>
            <Card>
              <Statistic
                title="Total Bookings"
                value={totalBookingsCount}
                prefix={<CalendarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Card>
              <Statistic
                title="Upcoming"
                value={stats.upcoming}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Card>
              <Statistic
                title="Completed"
                value={stats.completed}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Card>
              <Statistic
                title="Cancelled"
                value={stats.cancelled}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card>
          <Space align="center" wrap>
            <Typography.Text strong>Filter by Status:</Typography.Text>
            <Segmented
              value={filterStatus}
              options={filterOptions.map((option) => ({
                label: `${option.label} (${option.count})`,
                value: option.value,
              }))}
              onChange={(value) => handleFilterChange(value)}
            />
          </Space>
        </Card>

        {error && <Alert type="error" showIcon message={error} />}

        {bookings.length === 0 && loading ? (
          <Card>
            <Space align="center">
              <Spin />
              <Typography.Text type="secondary">
                Loading booking history...
              </Typography.Text>
            </Space>
          </Card>
        ) : bookings.length === 0 ? (
          <Card>
            <Empty description="No bookings match the selected filter." />
          </Card>
        ) : (
          <List
            dataSource={bookings}
            renderItem={(booking) => {
              const bookingId = booking?.id ?? booking?._id ?? booking?.startTime;
              const statusKey = determineStatusKey(booking, nowTimestamp);
              const config = statusConfig[statusKey] ?? {
                label: toTitle(statusKey),
                tagColor: "default",
                icon: <CalendarOutlined />,
              };

              const startDateText = formatDate(booking?.startTime);
              const startTimeText = formatTime(booking?.startTime);
              const bookedOnText = formatDate(booking?.createdAt);
              const totalAmount = resolveTotalAmount(booking);
              const priceText = formatCurrency(totalAmount);
              const stylistName = booking?.stylist?.fullName || "Assigned soon";
              const serviceSummary = summarizeServices(booking?.services);

              return (
                <List.Item key={bookingId}>
                  <Card style={{ width: "100%" }}>
                    <Row gutter={[16, 16]} align="middle">
                      <Col xs={24} md={16}>
                        <Space direction="vertical" size={4} style={{ width: "100%" }}>
                          <Typography.Title level={5} style={{ margin: 0 }}>
                            {serviceSummary}
                          </Typography.Title>
                          <Space wrap>
                            <Space size={6}>
                              <CalendarOutlined />
                              <Typography.Text type="secondary">{startDateText}</Typography.Text>
                            </Space>
                            <Space size={6}>
                              <ClockCircleOutlined />
                              <Typography.Text type="secondary">{startTimeText}</Typography.Text>
                            </Space>
                            <Space size={6}>
                              <UserOutlined />
                              <Typography.Text type="secondary">{stylistName}</Typography.Text>
                            </Space>
                          </Space>
                          <Typography.Text type="secondary">
                            Booked on: {bookedOnText}
                          </Typography.Text>
                        </Space>
                      </Col>

                      <Col xs={24} md={8}>
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Typography.Text strong style={{ fontSize: 16 }}>
                            <DollarOutlined /> {priceText}
                          </Typography.Text>
                          <Tag color={config.tagColor} icon={config.icon}>
                            {config.label}
                          </Tag>
                        </Space>
                      </Col>
                    </Row>

                    <div style={{ marginTop: 12 }}>
                      <Space wrap>
                        {statusKey === "upcoming" && (
                          <>
                            <Button type="primary">Reschedule</Button>
                            <Button danger>Cancel Booking</Button>
                          </>
                        )}
                        {statusKey === "completed" && (
                          <>
                            <Button type="primary">Book Again</Button>
                            <Button>Leave Review</Button>
                          </>
                        )}
                        <Button>View Details</Button>
                      </Space>
                    </div>
                  </Card>
                </List.Item>
              );
            }}
          />
        )}

        {loading && page > 1 && (
          <Typography.Text type="secondary" style={{ textAlign: "center" }}>
            Loading more bookings...
          </Typography.Text>
        )}

        {pagination.hasNextPage && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button type="primary" onClick={handleLoadMore} loading={loading}>
              Load More
            </Button>
          </div>
        )}
      </Space>
    </CustomerDashboardLayout>
  );
};

export default CustomerHistory;

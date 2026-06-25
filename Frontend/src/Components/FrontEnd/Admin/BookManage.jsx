import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/env.js";

const initialStats = {
  total: 0,
  pending: 0,
  confirmed: 0,
  inProgress: 0,
  completed: 0,
  cancelled: 0,
  paymentPaid: 0,
};

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in-progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const paymentOptions = [
  { value: "all", label: "DP Status" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "unpaid", label: "Unpaid" },
  { value: "refunded", label: "Refunded" },
];

const statusBadgeStyles = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  "in-progress": "bg-blue-100 text-blue-800",
  completed: "bg-purple-100 text-purple-800",
  cancelled: "bg-gray-200 text-gray-700",
};

const statusLabels = {
  pending: "Pending",
  confirmed: "Confirmed",
  "in-progress": "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const paymentBadgeStyles = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  unpaid: "bg-red-100 text-red-700",
  refunded: "bg-gray-200 text-gray-700",
};

const paymentLabels = {
  paid: "Paid",
  pending: "Pending",
  unpaid: "Unpaid",
  refunded: "Refunded",
};

const formatDateTime = (value, options = {}) => {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      ...options,
    }).format(date);
  } catch (error) {
    console.warn("Failed to format date", error);
    return "—";
  }
};

const toDateInputValue = (value) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
  } catch (error) {
    console.warn("Failed to convert date", error);
    return "";
  }
};

const getSlotDate = (booking) => {
  if (booking?.slot?.date) return booking.slot.date;
  if (booking?.startTime) return toDateInputValue(booking.startTime);
  return "";
};

const formatCurrency = (value) => {
  const numeric = Number(value ?? 0);
  if (Number.isNaN(numeric)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
};

const buildInitials = (name, fallback) => {
  if (!name) {
    return fallback?.slice(0, 2)?.toUpperCase() || "?";
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const BookManage = () => {
  const { token } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);

  const clearFeedbackAfterDelay = useCallback(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => clearFeedbackAfterDelay(), [clearFeedbackAfterDelay]);

  const fetchBookings = useCallback(async () => {
    if (!token) {
      setError("Authentication required.");
      setBookings([]);
      setStats(initialStats);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (paymentFilter !== "all") {
        params.append("paymentStatus", paymentFilter);
      }
      if (dateFilter) {
        params.append("dateFrom", dateFilter);
        params.append("dateTo", dateFilter);
      }

      const url = `${API_BASE_URL}/api/bookings${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch bookings");
      }

      setBookings(Array.isArray(data?.bookings) ? data.bookings : []);
      setStats({ ...initialStats, ...(data?.stats || {}) });
    } catch (fetchError) {
      console.error(fetchError);
      setError(fetchError?.message || "Failed to fetch bookings");
      setBookings([]);
      setStats(initialStats);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, paymentFilter, dateFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          booking.id,
          booking.payment?.invoiceNo,
          booking.user?.fullName,
          booking.user?.email,
          booking.user?.phone,
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));

      const matchesDate =
        !dateFilter ||
        getSlotDate(booking) === dateFilter ||
        toDateInputValue(booking.createdAt) === dateFilter;

      return matchesSearch && matchesDate;
    });
  }, [bookings, searchTerm, dateFilter]);

  const handleAction = useCallback(
    async (bookingId, action) => {
      if (!token || !bookingId) return;

      if (action === "cancel") {
        const result = await window.Swal.fire({
          title: "Cancel booking?",
          text: "This will mark the booking as cancelled.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#6b7280",
          confirmButtonText: "Yes, cancel it",
        });
        if (!result.isConfirmed) {
          return;
        }
      }

      setProcessingId(bookingId);
      setProcessingAction(action);
      setError("");

      try {
        const endpoint = `${API_BASE_URL}/api/bookings/${bookingId}/${action}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Request failed");
        }

        await fetchBookings();
        await window.Swal.fire({
          title: action === "accept" ? "Accepted" : "Cancelled",
          text:
            action === "accept"
              ? "Booking accepted successfully"
              : "Booking cancelled successfully",
          icon: "success",
          timer: 1400,
          showConfirmButton: false,
        });
      } catch (actionError) {
        console.error(actionError);
        await window.Swal.fire({
          title: "Action failed",
          text: actionError?.message || "Failed to process booking",
          icon: "error",
        });
      } finally {
        setProcessingId(null);
        setProcessingAction(null);
      }
    },
    [token, fetchBookings]
  );

  const statCards = [
    {
      title: "Total Bookings",
      value: stats.total,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-500",
      iconPath:
        "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    },
    {
      title: "Pending",
      value: stats.pending,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-500",
      iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      title: "Confirmed",
      value: stats.confirmed,
      iconBg: "bg-green-100",
      iconColor: "text-green-500",
      iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      title: "DP Paid",
      value: stats.paymentPaid,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-500",
      iconPath:
        "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
    },
  ];

  return (
    <AdminLayout title="Booking Management">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {error && (
            <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {feedback && (
            <div className="p-4 border border-green-200 bg-green-50 text-green-700 rounded-lg">
              {feedback}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map((card) => (
              <div
                key={card.title}
                className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200"
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div
                      className={`flex-shrink-0 ${card.iconBg} rounded-md p-3`}
                    >
                      <svg
                        className={`h-6 w-6 ${card.iconColor}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d={card.iconPath}
                        ></path>
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {card.title}
                        </dt>
                        <dd className="text-2xl font-bold text-gray-900">
                          {card.value}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by booking ID, customer name, phone, or invoice..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      ></path>
                    </svg>
                  </div>
                </div>
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              >
                {paymentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              />
              <button
                onClick={fetchBookings}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Booking List
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Booking
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Services
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Appointment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      DP Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-6 text-center text-sm text-gray-500"
                      >
                        Loading bookings...
                      </td>
                    </tr>
                  ) : filteredBookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-6 text-center text-sm text-gray-500"
                      >
                        No bookings found.
                      </td>
                    </tr>
                  ) : (
                    filteredBookings.map((booking) => {
                      const statusClass =
                        statusBadgeStyles[booking.status] ||
                        "bg-gray-200 text-gray-700";
                      const statusLabel =
                        statusLabels[booking.status] || booking.status;

                      const paymentStatus = booking.payment?.status;
                      const paymentClass = paymentStatus
                        ? paymentBadgeStyles[paymentStatus] ||
                          "bg-gray-200 text-gray-700"
                        : "bg-gray-200 text-gray-700";
                      const paymentLabel = paymentStatus
                        ? paymentLabels[paymentStatus] || paymentStatus
                        : "Unknown";

                      const servicesSummary = Array.isArray(booking.services)
                        ? booking.services
                            .map((service) => service.name)
                            .join(", ")
                        : "—";

                      const initials = buildInitials(
                        booking.user?.fullName,
                        booking.user?.email
                      );

                      const canAccept = booking.status === "pending";
                      const canCancel = !["cancelled", "completed"].includes(
                        booking.status
                      );
                      const isProcessing = processingId === booking.id;

                      return (
                        <tr
                          key={booking.id}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-gray-900">
                                {booking.id}
                              </span>
                              <span className="text-xs text-gray-500">
                                Invoice: {booking.payment?.invoiceNo || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                                  <span className="text-red-600 font-semibold">
                                    {initials}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {booking.user?.fullName || "Unknown"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {booking.user?.phone ||
                                    booking.user?.email ||
                                    "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 line-clamp-2">
                              {servicesSummary || "—"}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Stylist: {booking.stylist?.fullName || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDateTime(booking.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                            <div>{formatDateTime(booking.startTime)}</div>
                            <div className="text-xs text-gray-500">
                              Ends{" "}
                              {formatDateTime(booking.endTime, {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                                year: undefined,
                                month: undefined,
                                day: undefined,
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${paymentClass}`}
                            >
                              {paymentLabel}
                            </span>
                            <div className="text-xs text-gray-500 mt-1">
                              {formatCurrency(booking.payment?.dpAmount)} dp
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleAction(booking.id, "accept")}
                              disabled={!canAccept || isProcessing}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors duration-150 ${
                                canAccept
                                  ? "border-green-300 text-green-600 hover:bg-green-50"
                                  : "border-gray-200 text-gray-400 cursor-not-allowed"
                              } ${
                                isProcessing && processingAction === "accept"
                                  ? "opacity-70"
                                  : ""
                              }`}
                            >
                              {isProcessing && processingAction === "accept"
                                ? "Accepting..."
                                : "Accept"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(booking.id, "cancel")}
                              disabled={!canCancel || isProcessing}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors duration-150 ${
                                canCancel
                                  ? "border-red-300 text-red-600 hover:bg-red-50"
                                  : "border-gray-200 text-gray-400 cursor-not-allowed"
                              } ${
                                isProcessing && processingAction === "cancel"
                                  ? "opacity-70"
                                  : ""
                              }`}
                            >
                              {isProcessing && processingAction === "cancel"
                                ? "Cancelling..."
                                : "Cancel"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default BookManage;

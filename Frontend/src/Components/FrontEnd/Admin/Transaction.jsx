import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/env.js";

const initialStats = {
  total: 0,
  pending: 0,
  paid: 0,
  failed: 0,
  cancelled: 0,
  expired: 0,
  overdue: 0,
  refunded: 0,
  voided: 0,
  draft: 0,
};

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
  { value: "overdue", label: "Overdue" },
  { value: "refunded", label: "Refunded" },
  { value: "voided", label: "Voided" },
  { value: "draft", label: "Draft" },
];

const timeWindowOptions = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

const statusBadgeStyles = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-200 text-gray-600",
  expired: "bg-orange-100 text-orange-700",
  overdue: "bg-orange-200 text-orange-800",
  refunded: "bg-purple-100 text-purple-700",
  voided: "bg-gray-200 text-gray-600",
  draft: "bg-blue-100 text-blue-700",
};

const statusLabels = {
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
  overdue: "Overdue",
  refunded: "Refunded",
  voided: "Voided",
  draft: "Draft",
};

const formatCurrency = (value) => {
  if (value == null) return "—";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "—";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
};

const formatDateTime = (value, options = {}) => {
  if (!value) return "—";
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
};

const buildDateRange = (windowValue) => {
  if (windowValue === "all") return {};

  const now = new Date();
  const end = new Date(now);
  let start;

  switch (windowValue) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week": {
      const day = now.getDay();
      const diff = now.getDate() - day;
      start = new Date(now.getFullYear(), now.getMonth(), diff);
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return {};
  }

  return {
    dateFrom: start.toISOString(),
    dateTo: end.toISOString(),
  };
};

const getServicesSummary = (transaction) => {
  if (
    Array.isArray(transaction?.bookedServices) &&
    transaction.bookedServices.length > 0
  ) {
    const names = transaction.bookedServices
      .map((service) => service.name)
      .filter(Boolean);
    return names.length ? names.join(", ") : "Booking Services";
  }

  if (Array.isArray(transaction?.items) && transaction.items.length > 0) {
    const names = transaction.items
      .map((item) => item.name || item.description)
      .filter(Boolean);
    return names.length ? names.join(", ") : "Invoice Items";
  }

  return "—";
};

const getCustomerSummary = (transaction) => {
  if (transaction.customer) {
    const { name, email, phone } = transaction.customer;
    return {
      name: name || "Unknown Customer",
      contact: email || phone || "—",
    };
  }

  if (transaction.user) {
    const { fullName, email, phone } = transaction.user;
    return {
      name: fullName || "Unknown User",
      contact: email || phone || "—",
    };
  }

  return {
    name: "Unknown Customer",
    contact: "—",
  };
};

const Transaction = () => {
  const { token } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeWindow, setTimeWindow] = useState("all");

  const fetchTransactions = useCallback(async () => {
    if (!token) {
      setError("Authentication required");
      setTransactions([]);
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

      const range = buildDateRange(timeWindow);
      if (range.dateFrom) params.append("dateFrom", range.dateFrom);
      if (range.dateTo) params.append("dateTo", range.dateTo);

      const url = `${API_BASE_URL}/api/transactions${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "Failed to fetch transactions");
      }

      setTransactions(
        Array.isArray(result?.transactions) ? result.transactions : []
      );
      setStats({ ...initialStats, ...(result?.stats || {}) });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to fetch transactions");
      setTransactions([]);
      setStats(initialStats);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, timeWindow]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filteredTransactions = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();

    if (!normalized) return transactions;

    return transactions.filter((transaction) => {
      const invoiceNumber = transaction.invoice?.number || "";
      const orderId = transaction.orderId || "";
      const reference = transaction.reference || "";
      const customerName =
        transaction.customer?.name || transaction.user?.fullName || "";
      const customerEmail =
        transaction.customer?.email || transaction.user?.email || "";

      return [invoiceNumber, orderId, reference, customerName, customerEmail]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [transactions, searchTerm]);

  const paidRevenue = useMemo(
    () =>
      filteredTransactions
        .filter((transaction) => transaction.status === "paid")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    [filteredTransactions]
  );

  const identifierFor = (transaction) =>
    transaction.invoice?.number || transaction.orderId || transaction.id;

  const amountFor = (transaction) =>
    transaction.amount ?? transaction.grossAmount ?? 0;

  const statCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(paidRevenue),
      iconBg: "bg-green-100",
      iconColor: "text-green-500",
      iconPath:
        "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      title: "Total Transactions",
      value: stats.total,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-500",
      iconPath:
        "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    },
    {
      title: "Pending",
      value: stats.pending,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-500",
      iconPath: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      title: "Failed / Cancelled",
      value: (stats.failed || 0) + (stats.cancelled || 0),
      iconBg: "bg-red-100",
      iconColor: "text-red-500",
      iconPath: "M6 18L18 6M6 6l12 12",
    },
  ];

  const renderStatusBadge = (status) => {
    const normalized = status?.toLowerCase?.() || "pending";
    const classes =
      statusBadgeStyles[normalized] || "bg-gray-200 text-gray-600";

    return (
      <span
        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${classes}`}
      >
        {statusLabels[normalized] || status || "Pending"}
      </span>
    );
  };

  return (
    <AdminLayout title="Transaction Management">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {error && (
            <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-lg">
              {error}
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
                    placeholder="Search by invoice number, customer name, or email..."
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
                value={timeWindow}
                onChange={(event) => setTimeWindow(event.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              >
                {timeWindowOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={fetchTransactions}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Recent Transactions
              </h3>
              <p className="text-sm text-gray-500">
                Showing {filteredTransactions.length} of {stats.total}{" "}
                transactions
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transaction
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Services / Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-6 text-center text-sm text-gray-500"
                      >
                        Loading transactions...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-6 text-center text-sm text-gray-500"
                      >
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((transaction) => {
                      const identifier = identifierFor(transaction);
                      const customer = getCustomerSummary(transaction);

                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {identifier}
                            </div>
                            <div className="text-sm text-gray-500">
                              Invoice #{transaction.invoice?.number || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {customer.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {customer.contact}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {getServicesSummary(transaction)}
                            </div>
                            {transaction.booking?.id && (
                              <div className="text-xs text-gray-500">
                                Booking #{transaction.booking.id}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatCurrency(amountFor(transaction))}
                            </div>
                            <div className="text-xs text-gray-500">
                              Gross: {formatCurrency(transaction.grossAmount)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                              <svg
                                className="h-5 w-5 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                                ></path>
                              </svg>
                              <span>
                                {transaction.paymentType ||
                                  transaction.method ||
                                  "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {renderStatusBadge(transaction.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>{formatDateTime(transaction.createdAt)}</div>
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

export default Transaction;

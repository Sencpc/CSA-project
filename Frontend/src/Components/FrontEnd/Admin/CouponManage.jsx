import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../../context/AuthContext";

import { API_BASE_URL } from "../../../config/env.js";

const initialFormState = {
  code: "",
  description: "",
  discountType: "percent",
  amount: "",
  minSpend: "",
  startDate: "",
  endDate: "",
  usageLimit: "",
  usedCount: "0",
  isActive: true,
};

const statusBadgeStyles = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-200 text-gray-800",
  scheduled: "bg-blue-100 text-blue-800",
  expired: "bg-red-100 text-red-800",
  exhausted: "bg-yellow-100 text-yellow-800",
};

const statusLabelMap = {
  active: "Active",
  inactive: "Inactive",
  scheduled: "Scheduled",
  expired: "Expired",
  exhausted: "Usage Limit Reached",
};

const discountTypeLabels = {
  percent: "Percentage",
  fixed: "Fixed Amount",
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "—";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "—";
  return `${numeric}%`;
};

const formatDisplayDate = (value) => {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch (error) {
    console.warn("Failed to format date", error);
    return "—";
  }
};

const toDateInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const getUsageStats = (coupon) => {
  const used = Number(coupon?.usedCount ?? 0) || 0;
  const limitRaw = coupon?.usageLimit;
  const limit =
    limitRaw === null || limitRaw === undefined || limitRaw === ""
      ? null
      : Number(limitRaw);

  const hasLimit =
    typeof limit === "number" && !Number.isNaN(limit) && limit > 0;
  const percent = hasLimit
    ? Math.min(100, Math.round((used / limit) * 100))
    : 0;
  const limitReached = hasLimit && used >= limit;

  return {
    used,
    limit: hasLimit ? limit : null,
    percent,
    limitReached,
  };
};

const getCouponStatus = (coupon) => {
  if (!coupon) return "inactive";
  if (!coupon.isActive) return "inactive";

  const now = new Date();

  if (coupon.startDate) {
    const start = new Date(coupon.startDate);
    if (!Number.isNaN(start.getTime()) && start > now) {
      return "scheduled";
    }
  }

  if (coupon.endDate) {
    const end = new Date(coupon.endDate);
    if (!Number.isNaN(end.getTime()) && end < now) {
      return "expired";
    }
  }

  const { limitReached } = getUsageStats(coupon);
  if (limitReached) {
    return "exhausted";
  }

  return "active";
};

const isExpiringSoon = (coupon, days = 7) => {
  if (!coupon?.endDate) return false;
  const end = new Date(coupon.endDate);
  if (Number.isNaN(end.getTime())) return false;
  const now = new Date();
  if (end < now) return false;

  const diffInDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffInDays <= days;
};

const formatDiscountValue = (coupon) => {
  if (!coupon) return "—";
  if (coupon.discountType === "percent") {
    return formatPercent(coupon.amount);
  }
  return formatCurrency(coupon.amount);
};

const CouponManage = () => {
  const { token } = useAuth();

  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deletingCoupon, setDeletingCoupon] = useState(null);
  const [formState, setFormState] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCoupons = useCallback(async () => {
    if (!token) {
      setCoupons([]);
      setLoading(false);
      setError("Authentication required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/coupons`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch coupons");
      }

      setCoupons(Array.isArray(data?.coupons) ? data.coupons : []);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to fetch coupons");
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const derivedCoupons = useMemo(
    () =>
      coupons.map((coupon) => ({
        ...coupon,
        status: getCouponStatus(coupon),
        usage: getUsageStats(coupon),
        expiringSoon: isExpiringSoon(coupon),
      })),
    [coupons]
  );

  const filteredCoupons = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return derivedCoupons.filter((coupon) => {
      const matchesSearch =
        !normalizedSearch ||
        [coupon.code, coupon.description]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));

      const matchesStatus =
        statusFilter === "all" || coupon.status === statusFilter;

      const matchesType =
        typeFilter === "all" || coupon.discountType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [derivedCoupons, searchTerm, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = derivedCoupons.length;
    const active = derivedCoupons.filter(
      (coupon) => coupon.status === "active"
    ).length;
    const expiringSoonCount = derivedCoupons.filter(
      (coupon) => coupon.expiringSoon
    ).length;
    const totalUsage = derivedCoupons.reduce(
      (sum, coupon) => sum + (Number(coupon.usedCount ?? 0) || 0),
      0
    );

    return {
      total,
      active,
      expiringSoon: expiringSoonCount,
      totalUsage,
    };
  }, [derivedCoupons]);

  const resetForm = (overrides = {}) => {
    setFormState({ ...initialFormState, ...overrides });
    setFormErrors({});
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    resetForm({
      code: coupon.code ?? "",
      description: coupon.description ?? "",
      discountType: coupon.discountType ?? "percent",
      amount:
        coupon.amount !== undefined && coupon.amount !== null
          ? coupon.amount.toString()
          : "",
      minSpend:
        coupon.minSpend !== undefined && coupon.minSpend !== null
          ? coupon.minSpend.toString()
          : "",
      startDate: toDateInputValue(coupon.startDate),
      endDate: toDateInputValue(coupon.endDate),
      usageLimit:
        coupon.usageLimit !== undefined && coupon.usageLimit !== null
          ? coupon.usageLimit.toString()
          : "",
      usedCount:
        coupon.usedCount !== undefined && coupon.usedCount !== null
          ? coupon.usedCount.toString()
          : "0",
      isActive: Boolean(coupon.isActive),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCoupon(null);
    resetForm();
  };

  const openDeleteConfirm = (coupon) => {
    setDeletingCoupon(coupon);
    setIsDeleteOpen(true);
  };

  const closeDeleteConfirm = () => {
    setDeletingCoupon(null);
    setIsDeleteOpen(false);
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formState.code.trim()) {
      nextErrors.code = "Coupon code is required";
    }

    if (!formState.discountType) {
      nextErrors.discountType = "Discount type is required";
    }

    const amountValue = Number(formState.amount);
    if (!formState.amount.trim()) {
      nextErrors.amount = "Amount is required";
    } else if (Number.isNaN(amountValue) || amountValue <= 0) {
      nextErrors.amount = "Amount must be a positive number";
    } else if (formState.discountType === "percent" && amountValue > 100) {
      nextErrors.amount = "Percentage cannot exceed 100";
    }

    if (formState.minSpend) {
      const minSpendValue = Number(formState.minSpend);
      if (Number.isNaN(minSpendValue) || minSpendValue < 0) {
        nextErrors.minSpend = "Minimum spend must be zero or greater";
      }
    }

    if (formState.usageLimit) {
      const usageLimitValue = Number(formState.usageLimit);
      if (Number.isNaN(usageLimitValue) || usageLimitValue < 0) {
        nextErrors.usageLimit = "Usage limit must be zero or greater";
      }
    }

    if (editingCoupon && formState.usedCount) {
      const usedCountValue = Number(formState.usedCount);
      if (Number.isNaN(usedCountValue) || usedCountValue < 0) {
        nextErrors.usedCount = "Used count must be zero or greater";
      } else if (formState.usageLimit) {
        const usageLimitValue = Number(formState.usageLimit);
        if (
          !Number.isNaN(usageLimitValue) &&
          usedCountValue > usageLimitValue
        ) {
          nextErrors.usedCount = "Used count cannot exceed usage limit";
        }
      }
    }

    if (formState.startDate && formState.endDate) {
      const start = new Date(formState.startDate);
      const end = new Date(formState.endDate);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        if (end < start) {
          nextErrors.endDate = "End date must be after start date";
        }
      }
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormState((prev) => {
      if (type === "checkbox") {
        return { ...prev, [name]: checked };
      }

      if (name === "code") {
        return { ...prev, code: value.toUpperCase() };
      }

      return { ...prev, [name]: value };
    });
  };

  const buildPayload = () => {
    const payload = {
      code: formState.code.trim(),
      description: formState.description.trim() || undefined,
      discountType: formState.discountType,
      amount: Number(formState.amount),
      minSpend: formState.minSpend ? Number(formState.minSpend) : 0,
      startDate: formState.startDate
        ? new Date(formState.startDate).toISOString()
        : null,
      endDate: formState.endDate
        ? new Date(formState.endDate).toISOString()
        : null,
      usageLimit: formState.usageLimit
        ? Number(formState.usageLimit)
        : undefined,
      isActive: formState.isActive,
    };

    if (editingCoupon) {
      payload.usedCount = formState.usedCount ? Number(formState.usedCount) : 0;
    }

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setError("");

    try {
      const payload = buildPayload();

      const endpoint = editingCoupon
        ? `${API_BASE_URL}/api/coupons/${editingCoupon.id}`
        : `${API_BASE_URL}/api/coupons`;

      const response = await fetch(endpoint, {
        method: editingCoupon ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to save coupon");
      }

      if (editingCoupon) {
        setCoupons((prev) =>
          prev.map((coupon) =>
            coupon.id === data.coupon.id ? data.coupon : coupon
          )
        );
        setFeedback("Coupon updated successfully");
      } else {
        setCoupons((prev) => [data.coupon, ...prev]);
        setFeedback("Coupon created successfully");
      }

      closeModal();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to save coupon");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCoupon) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/coupons/${deletingCoupon.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete coupon");
      }

      setCoupons((prev) =>
        prev.filter((coupon) => coupon.id !== deletingCoupon.id)
      );
      setFeedback("Coupon deleted successfully");
      closeDeleteConfirm();
    } catch (err) {
      console.error(err);
      setError(err?.message || "Failed to delete coupon");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout title="Coupon Management">
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
            <div className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-red-100 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z"
                      ></path>
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Coupons
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900">
                        {stats.total}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-100 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-green-500"
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
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Coupons
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900">
                        {stats.active}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-yellow-100 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-yellow-500"
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
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Expiring Soon
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900">
                        {stats.expiringSoon}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-purple-100 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-purple-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      ></path>
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Uses
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900">
                        {stats.totalUsage}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by coupon code or description..."
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
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="scheduled">Scheduled</option>
                <option value="expired">Expired</option>
                <option value="exhausted">Usage Limit Reached</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Coupon List
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={fetchCoupons}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Refresh
                </button>
                <button
                  onClick={openCreateModal}
                  className="px-4 py-2 bg-red-300 text-white rounded-lg hover:bg-red-400 transition-colors duration-200 flex items-center gap-2"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    ></path>
                  </svg>
                  Create Coupon
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coupon
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Discount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Validity
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
                        colSpan={6}
                        className="px-6 py-6 text-center text-sm text-gray-500"
                      >
                        Loading coupons...
                      </td>
                    </tr>
                  ) : filteredCoupons.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-6 text-center text-sm text-gray-500"
                      >
                        No coupons found.
                      </td>
                    </tr>
                  ) : (
                    filteredCoupons.map((coupon) => {
                      const badgeClass =
                        statusBadgeStyles[coupon.status] ||
                        "bg-gray-100 text-gray-800";

                      return (
                        <tr
                          key={coupon.id}
                          className="hover:bg-gray-50 transition-colors duration-150"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-gray-900">
                                {coupon.code}
                              </span>
                              <span className="text-xs text-gray-500">
                                {coupon.description || "No description"}
                              </span>
                              <span className="text-xs text-gray-400 mt-1">
                                Created: {formatDisplayDate(coupon.createdAt)}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatDiscountValue(coupon)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {discountTypeLabels[coupon.discountType] || "—"}
                            </div>
                            {coupon.minSpend ? (
                              <div className="text-xs text-gray-400 mt-1">
                                Min spend {formatCurrency(coupon.minSpend)}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {coupon.usage.limit !== null
                                ? `${coupon.usage.used} / ${coupon.usage.limit}`
                                : `${coupon.usage.used} uses`}
                            </div>
                            {coupon.usage.limit !== null ? (
                              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                <div
                                  className={`h-1.5 rounded-full ${
                                    coupon.usage.limitReached
                                      ? "bg-red-400"
                                      : "bg-red-300"
                                  }`}
                                  style={{ width: `${coupon.usage.percent}%` }}
                                ></div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">
                                No usage limit
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>
                              Starts: {formatDisplayDate(coupon.startDate)}
                            </div>
                            <div>
                              Ends: {formatDisplayDate(coupon.endDate)}
                              {coupon.expiringSoon &&
                              coupon.status === "active" ? (
                                <span className="ml-2 text-xs text-yellow-600 font-medium">
                                  Expiring soon
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}`}
                            >
                              {statusLabelMap[coupon.status] || "Unknown"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                            <button
                              onClick={() => openEditModal(coupon)}
                              className="text-blue-600 hover:text-blue-900 transition-colors duration-150"
                            >
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                ></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => openDeleteConfirm(coupon)}
                              className="text-red-600 hover:text-red-900 transition-colors duration-150"
                            >
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                ></path>
                              </svg>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h4 className="text-lg font-semibold text-gray-900">
                {editingCoupon ? "Edit Coupon" : "Create Coupon"}
              </h4>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Coupon Code
                  </label>
                  <input
                    name="code"
                    value={formState.code}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.code ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="Enter coupon code"
                  />
                  {formErrors.code && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.code}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Type
                  </label>
                  <select
                    name="discountType"
                    value={formState.discountType}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.discountType
                        ? "border-red-300"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="percent">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                  {formErrors.discountType && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.discountType}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount
                  </label>
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    max={
                      formState.discountType === "percent" ? "100" : undefined
                    }
                    value={formState.amount}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.amount ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder={
                      formState.discountType === "percent"
                        ? "Enter percentage (0-100)"
                        : "Enter discount amount"
                    }
                  />
                  {formErrors.amount && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.amount}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Spend (Optional)
                  </label>
                  <input
                    name="minSpend"
                    type="number"
                    min="0"
                    value={formState.minSpend}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.minSpend ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="Enter minimum spend"
                  />
                  {formErrors.minSpend && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.minSpend}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    name="startDate"
                    type="date"
                    value={formState.startDate}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    name="endDate"
                    type="date"
                    value={formState.endDate}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.endDate ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  {formErrors.endDate && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.endDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Usage Limit (Optional)
                  </label>
                  <input
                    name="usageLimit"
                    type="number"
                    min="0"
                    value={formState.usageLimit}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.usageLimit
                        ? "border-red-300"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter usage limit"
                  />
                  {formErrors.usageLimit && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.usageLimit}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Used Count
                  </label>
                  <input
                    name="usedCount"
                    type="number"
                    min="0"
                    value={formState.usedCount}
                    onChange={handleFormChange}
                    disabled={!editingCoupon}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.usedCount
                        ? "border-red-300"
                        : "border-gray-300"
                    } ${editingCoupon ? "" : "bg-gray-100 cursor-not-allowed"}`}
                    placeholder="Set used count"
                  />
                  {!editingCoupon && (
                    <p className="mt-1 text-xs text-gray-500">
                      Used count starts at 0 and updates automatically.
                    </p>
                  )}
                  {formErrors.usedCount && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.usedCount}
                    </p>
                  )}
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    name="description"
                    value={formState.description}
                    onChange={handleFormChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                    placeholder="Describe the coupon"
                  ></textarea>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">
                    Active
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formState.isActive}
                      onChange={handleFormChange}
                      className="sr-only"
                    />
                    <div
                      className={`w-14 h-7 rounded-full transition-colors duration-200 ${
                        formState.isActive ? "bg-red-400" : "bg-gray-300"
                      }`}
                    >
                      <div
                        className={`absolute mt-1 ml-1 w-5 h-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                          formState.isActive ? "translate-x-7" : "translate-x-0"
                        }`}
                      ></div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-300 text-white rounded-lg hover:bg-red-400 transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "Saving..." : "Save Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h4 className="text-lg font-semibold text-gray-900">
                Delete Coupon
              </h4>
            </div>
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-gray-900">
                  {deletingCoupon?.code}
                </span>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default CouponManage;

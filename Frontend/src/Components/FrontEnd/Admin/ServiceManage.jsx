import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/env.js";

const initialStats = {
  total: 0,
  active: 0,
  inactive: 0,
  featured: 0,
};

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const featuredOptions = [
  { value: "all", label: "All Services" },
  { value: "featured", label: "Featured" },
  { value: "regular", label: "Regular" },
];

const defaultFormState = {
  name: "",
  categoryId: "",
  description: "",
  priceMin: "",
  priceMax: "",
  durationMinutes: "",
  benefitsText: "",
  featured: false,
  active: true,
};

const formatCurrency = (value) => {
  const numeric = Number(value ?? 0);
  if (Number.isNaN(numeric)) {
    return "—";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
};

const formatDuration = (minutes) => {
  const value = Number(minutes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 60) return `${value} mins`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${hours}h${mins ? ` ${mins}m` : ""}`;
};

const buildBenefitsPreview = (benefits) => {
  if (!Array.isArray(benefits) || benefits.length === 0) return "—";
  if (benefits.length === 1) return benefits[0];
  return `${benefits[0]}, +${benefits.length - 1} more`;
};

const parseBenefitsText = (text) =>
  text
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const ServiceManage = () => {
  const { token } = useAuth();

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [currentService, setCurrentService] = useState(null);
  const [formData, setFormData] = useState(defaultFormState);

  const clearFeedbackAfterDelay = useCallback(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => clearFeedbackAfterDelay(), [clearFeedbackAfterDelay]);

  const resetForm = useCallback(() => {
    setFormData(defaultFormState);
    setCurrentService(null);
    setModalMode("create");
  }, []);

  const fetchServices = useCallback(async () => {
    if (!token) {
      setError("Authentication required");
      setServices([]);
      setCategories([]);
      setStats(initialStats);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (appliedSearch) {
        params.append("search", appliedSearch);
      }

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (categoryFilter !== "all") {
        params.append("categoryId", categoryFilter);
      }

      if (featuredFilter !== "all") {
        params.append(
          "featured",
          featuredFilter === "featured" ? "true" : "false"
        );
      }

      const url = `${API_BASE_URL}/api/services${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch services");
      }

      setServices(Array.isArray(data?.services) ? data.services : []);
      setStats({ ...initialStats, ...(data?.stats || {}) });
      setCategories(Array.isArray(data?.categories) ? data.categories : []);
    } catch (fetchError) {
      console.error(fetchError);
      setError(fetchError?.message || "Failed to fetch services");
      setServices([]);
      setStats(initialStats);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [token, appliedSearch, statusFilter, categoryFilter, featuredFilter]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const filteredServices = useMemo(() => {
    if (!searchTerm || searchTerm === appliedSearch) {
      return services;
    }

    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return services;

    return services.filter((service) => {
      const values = [
        service.name,
        service.description,
        service.category?.name,
        service.slug,
      ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());

      return values.some((value) => value.includes(normalized));
    });
  }, [services, searchTerm, appliedSearch]);

  const statCards = [
    {
      title: "Total Services",
      value: stats.total,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-500",
      iconPath:
        "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    },
    {
      title: "Active",
      value: stats.active,
      iconBg: "bg-green-100",
      iconColor: "text-green-500",
      iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    },
    {
      title: "Inactive",
      value: stats.inactive,
      iconBg: "bg-gray-100",
      iconColor: "text-gray-500",
      iconPath:
        "M10 2a1 1 0 00-.894.553L7.382 6H4a1 1 0 000 2h1.278l1.4 7H5a1 1 0 100 2h10a1 1 0 100-2h-.678l1.4-7H20a1 1 0 100-2h-3.382l-1.724-3.447A1 1 0 0014 2H10z",
    },
    {
      title: "Featured",
      value: stats.featured,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-500",
      iconPath:
        "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
    },
  ];

  const openCreateModal = () => {
    resetForm();
    setModalMode("create");
    setShowModal(true);
  };

  const openEditModal = (service) => {
    setCurrentService(service);
    setModalMode("edit");
    setFormData({
      name: service.name || "",
      categoryId: service.categoryId || "",
      description: service.description || "",
      priceMin: service.priceMin?.toString() ?? "",
      priceMax: service.priceMax?.toString() ?? "",
      durationMinutes: service.durationMinutes?.toString() ?? "",
      benefitsText: Array.isArray(service.benefits)
        ? service.benefits.join("\n")
        : "",
      featured: Boolean(service.featured),
      active: Boolean(service.active),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError("Service name is required");
      return false;
    }

    const priceMin = Number(formData.priceMin);
    const priceMax = Number(formData.priceMax);
    const duration = Number(formData.durationMinutes);

    if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax)) {
      setError("Price range must be valid numbers");
      return false;
    }

    if (priceMin < 0 || priceMax < 0) {
      setError("Price cannot be negative");
      return false;
    }

    if (priceMax < priceMin) {
      setError("Max price should be greater than or equal to min price");
      return false;
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Duration must be a positive number of minutes");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!token) {
      setError("Authentication required");
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name: formData.name.trim(),
        categoryId: formData.categoryId || null,
        description: formData.description.trim() || null,
        priceMin: Number(formData.priceMin),
        priceMax: Number(formData.priceMax),
        durationMinutes: Number(formData.durationMinutes),
        benefits: parseBenefitsText(formData.benefitsText),
        featured: Boolean(formData.featured),
        active: Boolean(formData.active),
      };

      const isCreate = modalMode === "create";
      const endpoint = isCreate
        ? `${API_BASE_URL}/api/services`
        : `${API_BASE_URL}/api/services/${currentService.id}`;

      const response = await fetch(endpoint, {
        method: isCreate ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to save service");
      }

      setFeedback(
        isCreate
          ? "Service created successfully"
          : "Service updated successfully"
      );
      closeModal();
      await fetchServices();
    } catch (submitError) {
      console.error(submitError);
      setError(submitError?.message || "Failed to save service");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service) => {
    if (!token || !service?.id) return;

    const result = await window.Swal.fire({
      title: "Delete service?",
      html: `This will permanently delete <b>${service.name}</b>.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it",
    });

    if (!result.isConfirmed) return;

    setDeletingId(service.id);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/services/${service.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete service");
      }

      await window.Swal.fire({
        title: "Deleted",
        text: "Service deleted successfully",
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
      });
      await fetchServices();
    } catch (deleteError) {
      console.error(deleteError);
      await window.Swal.fire({
        title: "Delete failed",
        text: deleteError?.message || "Failed to delete service",
        icon: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setAppliedSearch(searchTerm.trim());
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setAppliedSearch("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setFeaturedFilter("all");
  };

  const categoryOptions = useMemo(
    () => [{ id: "all", name: "All Categories" }, ...categories],
    [categories]
  );

  return (
    <AdminLayout title="Service Management">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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
                        {card.value ?? 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="bg-white rounded-lg shadow-sm p-6 flex flex-col gap-4 lg:flex-row lg:items-end"
        >
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by name, description, or category..."
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              >
                {categoryOptions.map((categoryOption) => (
                  <option key={categoryOption.id} value={categoryOption.id}>
                    {categoryOption.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Featured
              </label>
              <select
                value={featuredFilter}
                onChange={(event) => setFeaturedFilter(event.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              >
                {featuredOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors duration-200"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Reset
            </button>
          </div>
        </form>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Service List
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={fetchServices}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="px-4 py-2 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors duration-200 flex items-center gap-2"
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
                Create Service
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Benefits
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Flags
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
                      colSpan={7}
                      className="px-6 py-6 text-center text-sm text-gray-500"
                    >
                      Loading services...
                    </td>
                  </tr>
                ) : filteredServices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-6 text-center text-sm text-gray-500"
                    >
                      No services found.
                    </td>
                  </tr>
                ) : (
                  filteredServices.map((service) => (
                    <tr
                      key={service.id}
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-900">
                            {service.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            {service.description || "No description"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          {service.category?.name || "Uncategorized"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="font-semibold">
                          {formatCurrency(service.priceMin)}
                        </div>
                        <div className="text-xs text-gray-500">
                          to {formatCurrency(service.priceMax)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDuration(service.durationMinutes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {buildBenefitsPreview(service.benefits)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              service.active
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {service.active ? "Active" : "Inactive"}
                          </span>
                          {service.featured && (
                            <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-700">
                              Featured
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditModal(service)}
                          className="text-blue-600 hover:text-blue-900 transition-colors duration-150"
                        >
                          <svg
                            className="h-5 w-5 inline"
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
                          type="button"
                          onClick={() => handleDelete(service)}
                          disabled={deletingId === service.id}
                          className={`text-red-600 hover:text-red-900 transition-colors duration-150 ${
                            deletingId === service.id ? "opacity-70" : ""
                          }`}
                        >
                          <svg
                            className="h-5 w-5 inline"
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/20 px-4">
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-lg">
                <div>
                  <h3 className="text-xl font-semibold text-black">
                    {modalMode === "create" ? "Create Service" : "Edit Service"}
                  </h3>
                  <p className="text-sm text-black">
                    {modalMode === "create"
                      ? "Add a new service to your catalogue"
                      : `Editing ${currentService?.name}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-gray-400 hover:text-black transition-colors duration-150"
                >
                  <svg
                    className="h-6 w-6"
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
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="px-6 py-6 space-y-6 max-h-[70vh] overflow-y-auto"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Service Name
                    </label>
                    <input
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                      placeholder="e.g., Premium Haircut"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      name="categoryId"
                      value={formData.categoryId}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes)
                    </label>
                    <input
                      name="durationMinutes"
                      type="number"
                      min="1"
                      value={formData.durationMinutes}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Price (IDR)
                    </label>
                    <input
                      name="priceMin"
                      type="number"
                      min="0"
                      value={formData.priceMin}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Price (IDR)
                    </label>
                    <input
                      name="priceMax"
                      type="number"
                      min="0"
                      value={formData.priceMax}
                      onChange={handleFormChange}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleFormChange}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                      placeholder="Describe the service, key highlights, and what customers can expect"
                    ></textarea>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Benefits (one per line)
                    </label>
                    <textarea
                      name="benefitsText"
                      value={formData.benefitsText}
                      onChange={handleFormChange}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                      placeholder={`Professional stylist guidance\nComplimentary hair wash\nPersonalized styling tips`}
                    ></textarea>
                  </div>

                  <div className="flex items-center gap-4 md:col-span-2">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        name="featured"
                        checked={formData.featured}
                        onChange={handleFormChange}
                        className="h-4 w-4 text-red-400 focus:ring-red-300 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Mark as featured
                      </span>
                    </label>

                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        name="active"
                        checked={formData.active}
                        onChange={handleFormChange}
                        className="h-4 w-4 text-red-400 focus:ring-red-300 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={`px-4 py-2 bg-red-400 text-white rounded-lg hover:bg-red-500 transition-colors duration-200 flex items-center gap-2 ${
                      saving ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                  >
                    {saving && (
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {modalMode === "create" ? "Create" : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default ServiceManage;

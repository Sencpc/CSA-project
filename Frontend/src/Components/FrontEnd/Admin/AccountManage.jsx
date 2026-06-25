import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "./AdminLayout";
import { useAuth } from "../../../context/AuthContext";
import defaultAvatar from "../../../assets/AdminAsset/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-illustration-vector-removebg-preview.png";

import {
  Avatar,
  Button,
  Card,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";

import { API_BASE_URL } from "../../../config/env.js";

const initialFormState = {
  fullName: "",
  email: "",
  phone: "",
  role: "admin",
  status: "active",
  password: "",
};

const statusBadgeStyles = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-200 text-gray-800",
};

const roleBadgeStyles = {
  admin: "bg-purple-100 text-purple-800",
  customer: "bg-blue-100 text-blue-800",
};

const formatDisplayDate = (value) => {
  if (!value) return "—";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }

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

const AccountManage = () => {
  const { token, user } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deletingAccount, setDeletingAccount] = useState(null);
  const [formState, setFormState] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!token) {
      setAccounts([]);
      setLoading(false);
      setError("Authentication required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch accounts");
      }

      setAccounts(Array.isArray(data?.users) ? data.users : []);
    } catch (err) {
      setError(err?.message || "Failed to fetch accounts");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (!feedback) return undefined;

    const timer = setTimeout(() => setFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return accounts.filter((account) => {
      const matchesSearch =
        !normalizedSearch ||
        [account.fullName, account.email, account.phone]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch));

      const matchesStatus =
        statusFilter === "all" || account.status === statusFilter;

      const matchesRole = roleFilter === "all" || account.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [accounts, searchTerm, statusFilter, roleFilter]);

  const totalCustomers = useMemo(
    () => accounts.filter((account) => account.role === "customer").length,
    [accounts]
  );
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.status === "active").length,
    [accounts]
  );
  const inactiveAccounts = useMemo(
    () => accounts.filter((account) => account.status === "inactive").length,
    [accounts]
  );

  const resetForm = (overrides = {}) => {
    setFormState({ ...initialFormState, ...overrides });
    setFormErrors({});
  };

  const openCreateModal = () => {
    setEditingAccount(null);
    resetForm({ role: "admin", status: "active" });
    setIsModalOpen(true);
  };

  const openEditModal = (account) => {
    setEditingAccount(account);
    resetForm({
      fullName: account.fullName ?? "",
      email: account.email ?? "",
      phone: account.phone ?? "",
      role: account.role ?? "customer",
      status: account.status ?? "active",
      password: "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAccount(null);
    resetForm();
  };

  const openDeleteConfirm = (account) => {
    setDeletingAccount(account);
    setIsDeleteOpen(true);
  };

  const closeDeleteConfirm = () => {
    setDeletingAccount(null);
    setIsDeleteOpen(false);
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formState.fullName.trim()) {
      nextErrors.fullName = "Full name is required";
    }

    if (!formState.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      nextErrors.email = "Please enter a valid email";
    }

    if (!formState.phone.trim()) {
      nextErrors.phone = "Phone number is required";
    }

    if (!editingAccount && !formState.password.trim()) {
      nextErrors.password = "Password is required";
    } else if (
      formState.password.trim() &&
      formState.password.trim().length < 6
    ) {
      nextErrors.password = "Password must be at least 6 characters";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setError("");

    try {
      const payload = {
        fullName: formState.fullName.trim(),
        email: formState.email.trim(),
        phone: formState.phone.trim(),
        role: formState.role,
        status: formState.status,
      };

      if (formState.password.trim()) {
        payload.password = formState.password.trim();
      }

      const endpoint = editingAccount
        ? `${API_BASE_URL}/api/users/${editingAccount.id}`
        : `${API_BASE_URL}/api/users`;

      const response = await fetch(endpoint, {
        method: editingAccount ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to save account");
      }

      if (editingAccount) {
        setAccounts((prev) =>
          prev.map((account) =>
            account.id === data.user.id ? data.user : account
          )
        );
        setFeedback("Account updated successfully");
      } else {
        setAccounts((prev) => [data.user, ...prev]);
        setFeedback("Account created successfully");
      }

      closeModal();
    } catch (err) {
      setError(err?.message || "Failed to save account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/${deletingAccount.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to delete account");
      }

      setAccounts((prev) =>
        prev.filter((account) => account.id !== deletingAccount.id)
      );
      setFeedback("Account deleted successfully");
      closeDeleteConfirm();
    } catch (err) {
      setError(err?.message || "Failed to delete account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const tableColumns = [
    {
      title: "Name",
      dataIndex: "fullName",
      key: "name",
      render: (_, account) => (
        <Space>
          <Avatar
            src={account.avatarUrl || defaultAvatar}
            alt={account.fullName}
            size={40}
          />
          <div>
            <Typography.Text strong>{account.fullName}</Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                ID: {account.id}
              </Typography.Text>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      render: (_, account) => (
        <div>
          <div>
            <Typography.Text>{account.email}</Typography.Text>
          </div>
          <Typography.Text type="secondary">{account.phone || "—"}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role) => (
        <Tag color={role === "admin" ? "purple" : "blue"}>
          {role === "admin" ? "Admin" : "Customer"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={status === "active" ? "green" : "default"}>
          {status === "active" ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Join Date",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (value) => (
        <Typography.Text type="secondary">{formatDisplayDate(value)}</Typography.Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      align: "right",
      render: (_, account) => {
        const isCurrentUser = account.id === user?.id;

        return (
          <Space size={8}>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(account)}
            />
            <Button
              type="text"
              danger
              disabled={isCurrentUser}
              icon={<DeleteOutlined />}
              onClick={() => openDeleteConfirm(account)}
            />
          </Space>
        );
      },
    },
  ];

  return (
    <AdminLayout title="Account Management">
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

          {/* Stats */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      ></path>
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Customers
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900">
                        {totalCustomers}
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
                        Active Accounts
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900">
                        {activeAccounts}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-gray-100 rounded-md p-3">
                    <svg
                      className="h-6 w-6 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                      ></path>
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Inactive Accounts
                      </dt>
                      <dd className="text-2xl font-bold text-gray-900">
                        {inactiveAccounts}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name, email, or phone..."
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
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="customer">Customer</option>
              </select>
            </div>
          </div>

          {/* Accounts Table */}
          <Card
            title="Accounts"
            extra={
              <Button
                onClick={openCreateModal}
                type="primary"
                danger
                icon={<PlusOutlined />}
              >
                Add Account
              </Button>
            }
          >
            <Table
              rowKey="id"
              loading={loading}
              columns={tableColumns}
              dataSource={filteredAccounts}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={isModalOpen}
        onCancel={closeModal}
        title={editingAccount ? "Edit Account" : "Create Account"}
        footer={null}
        destroyOnClose
        width={720}
      >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    name="fullName"
                    value={formState.fullName}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.fullName ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="Enter full name"
                  />
                  {formErrors.fullName && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.fullName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formState.email}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.email ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="Enter email"
                  />
                  {formErrors.email && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    name="phone"
                    value={formState.phone}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.phone ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder="Enter phone number"
                  />
                  {formErrors.phone && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.phone}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <select
                    name="role"
                    value={formState.role}
                    onChange={handleFormChange}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                  >
                    <option value="admin">Admin</option>
                    <option value="customer">Customer</option>
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formState.status}
                    onChange={handleFormChange}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {editingAccount ? "New Password" : "Password"}
                  </label>
                  <input
                    name="password"
                    type="password"
                    value={formState.password}
                    onChange={handleFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-300 focus:border-transparent ${
                      formErrors.password ? "border-red-300" : "border-gray-300"
                    }`}
                    placeholder={
                      editingAccount
                        ? "Leave blank to keep current password"
                        : "Enter password"
                    }
                  />
                  {formErrors.password && (
                    <p className="mt-1 text-xs text-red-500">
                      {formErrors.password}
                    </p>
                  )}
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
                  {isSubmitting ? "Saving..." : "Save Account"}
                </button>
              </div>
            </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={isDeleteOpen}
        onCancel={closeDeleteConfirm}
        title="Delete Account"
        okText={isSubmitting ? "Deleting..." : "Delete"}
        okButtonProps={{ danger: true, loading: isSubmitting }}
        onOk={handleDelete}
        destroyOnClose
      >
        <Typography.Text>
          Are you sure you want to delete{" "}
          <Typography.Text strong>{deletingAccount?.fullName}</Typography.Text>?
          This action cannot be undone.
        </Typography.Text>
      </Modal>
    </AdminLayout>
  );
};

export default AccountManage;

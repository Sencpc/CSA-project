import { useCallback, useEffect, useMemo, useState } from "react";
import CustomerDashboardLayout from "./CustomerDashboardLayout";
import { useAuth } from "../../../context/AuthContext";
import { API_BASE_URL } from "../../../config/env.js";

import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  List,
  Modal,
  Space,
  Spin,
  Switch,
  Typography,
  message,
} from "antd";

import {
  BellOutlined,
  CalendarOutlined,
  DeleteOutlined,
  GiftOutlined,
  MailOutlined,
  MessageOutlined,
  ReadOutlined,
  SkinOutlined,
} from "@ant-design/icons";

const DEFAULT_NOTIFICATIONS = {
  email: true,
  sms: false,
  push: true,
  bookingReminders: true,
  promotions: false,
  newsletter: true,
};

const NOTIFICATION_KEYS = Object.keys(DEFAULT_NOTIFICATIONS);

const CustomerSettings = () => {
  const { token, updateUser, logout } = useAuth();

  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(() => ({
    ...DEFAULT_NOTIFICATIONS,
  }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [serverSettings, setServerSettings] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const applySettings = useCallback((settings, { store = false } = {}) => {
    if (!settings) {
      return;
    }

    const isDark =
      typeof settings.darkMode === "boolean"
        ? settings.darkMode
        : (settings.theme || "light").toLowerCase() === "dark";

    setDarkMode(isDark);

    setNotifications(() => {
      const next = { ...DEFAULT_NOTIFICATIONS };
      if (
        settings.notificationPrefs &&
        typeof settings.notificationPrefs === "object"
      ) {
        NOTIFICATION_KEYS.forEach((key) => {
          if (settings.notificationPrefs[key] !== undefined) {
            next[key] = Boolean(settings.notificationPrefs[key]);
          }
        });
      }
      return next;
    });

    if (store) {
      setServerSettings(settings);
    }
  }, []);

  const fetchSettings = useCallback(
    async (signal) => {
      if (!token) {
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/customer/settings`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        ...(signal ? { signal } : {}),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to load settings");
      }

      const payload = await response.json();
      applySettings(payload?.settings, { store: true });
      setError("");
    },
    [applySettings, token]
  );

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetchSettings(controller.signal)
      .catch((err) => {
        console.error("Failed to load settings", err);
        setError(err.message || "Failed to load settings");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [token, fetchSettings]);

  useEffect(() => {
    if (!saveMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setSaveMessage("");
    }, 4000);

    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  const toggleDarkMode = () => {
    if (loading || saving) {
      return;
    }
    setError("");
    setSaveMessage("");
    setDarkMode((previous) => {
      return !previous;
    });
  };

  const handleNotificationChange = (key) => {
    if (loading || saving) {
      return;
    }
    setError("");
    setSaveMessage("");
    setNotifications((previous) => {
      return { ...previous, [key]: !previous[key] };
    });
  };

  const handleSaveSettings = async () => {
    if (!hasChanges || saving) {
      return;
    }

    if (!token) {
      setError("You must be signed in to update settings.");
      return;
    }

    try {
      setSaving(true);
      setSaveMessage("");
      setError("");

      const response = await fetch(`${API_BASE_URL}/api/customer/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          darkMode,
          notificationPrefs: notifications,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to update settings");
      }

      const payload = await response.json();
      applySettings(payload?.settings, { store: true });

      if (payload?.user) {
        updateUser(payload.user);
      }

      setSaveMessage("Settings updated successfully.");
    } catch (err) {
      console.error("Failed to update settings", err);
      setError(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handleResetSettings = () => {
    if (saving || loading) {
      return;
    }
    if (serverSettings) {
      applySettings(serverSettings, { store: false });
      setError("");
      setSaveMessage("");
    } else if (token) {
      setLoading(true);
      fetchSettings()
        .catch((err) => {
          console.error("Failed to reload settings", err);
          setError(err.message || "Failed to load settings");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    if (!serverSettings) {
      const defaultDiff =
        darkMode !== false ||
        NOTIFICATION_KEYS.some(
          (key) => DEFAULT_NOTIFICATIONS[key] !== Boolean(notifications[key])
        );
      setHasChanges(defaultDiff);
      return;
    }

    const serverDarkMode =
      typeof serverSettings.darkMode === "boolean"
        ? serverSettings.darkMode
        : (serverSettings.theme || "light").toLowerCase() === "dark";

    const serverPrefs = { ...DEFAULT_NOTIFICATIONS };
    if (
      serverSettings.notificationPrefs &&
      typeof serverSettings.notificationPrefs === "object"
    ) {
      NOTIFICATION_KEYS.forEach((key) => {
        if (serverSettings.notificationPrefs[key] !== undefined) {
          serverPrefs[key] = Boolean(serverSettings.notificationPrefs[key]);
        }
      });
    }

    const hasDiff =
      serverDarkMode !== darkMode ||
      NOTIFICATION_KEYS.some(
        (key) => serverPrefs[key] !== Boolean(notifications[key])
      );

    setHasChanges(hasDiff);
  }, [darkMode, notifications, serverSettings]);

  const handleDeleteAccount = async () => {
    if (confirmText !== "DELETE") {
      message.warning("Please type DELETE to confirm");
      return;
    }

    if (!token) {
      message.error("You must be signed in to deactivate your account.");
      return;
    }

    try {
      setDeleteLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/api/customer/settings/deactivate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: deleteReason }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || "Failed to deactivate account");
      }

      const payload = await response.json();

      if (payload?.user) {
        updateUser(payload.user);
      }

      message.success(
        payload?.message ||
          "Your account has been deactivated. You can reactivate it within 30 days by logging in again."
      );

      setShowDeleteModal(false);
      setDeleteReason("");
      setConfirmText("");
      setDeleteLoading(false);

      logout();
    } catch (err) {
      console.error("Failed to deactivate account", err);
      message.error(err.message || "Failed to deactivate account");
      setDeleteLoading(false);
    }
  };

  const disableInteractions = loading || saving;

  const notificationItems = useMemo(
    () => [
      {
        key: "email",
        title: "Email Notifications",
        description: "Receive updates via email",
        icon: <MailOutlined />,
      },
      {
        key: "sms",
        title: "SMS Notifications",
        description: "Get text messages for updates",
        icon: <MessageOutlined />,
      },
      {
        key: "push",
        title: "Push Notifications",
        description: "Browser push notifications",
        icon: <BellOutlined />,
      },
      {
        key: "bookingReminders",
        title: "Booking Reminders",
        description: "Reminders for upcoming appointments",
        icon: <CalendarOutlined />,
      },
      {
        key: "promotions",
        title: "Promotions & Offers",
        description: "Special deals and discounts",
        icon: <GiftOutlined />,
      },
      {
        key: "newsletter",
        title: "Newsletter",
        description: "Beauty tips and trends newsletter",
        icon: <ReadOutlined />,
      },
    ],
    []
  );

  return (
    <CustomerDashboardLayout title="Settings">
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ flex: "1 1 420px" }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                {error ? <Alert type="error" showIcon message={error} /> : null}
                {!error && saveMessage ? (
                  <Alert type="success" showIcon message={saveMessage} />
                ) : null}
              </Space>
            </div>

            <Space>
              <Button
                onClick={handleResetSettings}
                disabled={disableInteractions || (!hasChanges && !serverSettings)}
              >
                Reset
              </Button>
              <Button
                type="primary"
                onClick={handleSaveSettings}
                disabled={!hasChanges || disableInteractions}
                loading={saving}
              >
                Save Settings
              </Button>
            </Space>
          </div>

          <Spin spinning={loading} tip="Loading settings...">
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <Card
                title={
                  <Space>
                    <SkinOutlined />
                    <span>Appearance</span>
                  </Space>
                }
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Typography.Text strong>Dark Mode</Typography.Text>
                    <div>
                      <Typography.Text type="secondary">
                        Switch between light and dark theme
                      </Typography.Text>
                    </div>
                  </div>
                  <Switch
                    checked={darkMode}
                    onChange={(checked) => {
                      if (disableInteractions) return;
                      setError("");
                      setSaveMessage("");
                      setDarkMode(Boolean(checked));
                    }}
                    disabled={disableInteractions}
                  />
                </div>
              </Card>

              <Card
                title={
                  <Space>
                    <BellOutlined />
                    <span>Notification Preferences</span>
                  </Space>
                }
              >
                <List
                  itemLayout="horizontal"
                  dataSource={notificationItems}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Switch
                          key="toggle"
                          checked={Boolean(notifications[item.key])}
                          onChange={(checked) => {
                            if (disableInteractions) return;
                            setError("");
                            setSaveMessage("");
                            setNotifications((previous) => ({
                              ...previous,
                              [item.key]: Boolean(checked),
                            }));
                          }}
                          disabled={disableInteractions}
                        />,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={item.icon}
                        title={item.title}
                        description={item.description}
                      />
                    </List.Item>
                  )}
                />
              </Card>

              <Card
                title={
                  <Space>
                    <DeleteOutlined />
                    <span>Danger Zone</span>
                  </Space>
                }
              >
                <Alert
                  type="warning"
                  showIcon
                  message="Delete Account"
                  description={
                    <Space direction="vertical" size="small" style={{ width: "100%" }}>
                      <Typography.Text>
                        Once you delete your account, all your data will be
                        deactivated. You can reactivate your account within 30
                        days by logging in again. After 30 days, your data will
                        be permanently deleted.
                      </Typography.Text>
                      <Divider style={{ margin: "8px 0" }} />
                      <List
                        size="small"
                        dataSource={[
                          "Your booking history will be archived",
                          "You can reactivate within 30 days",
                          "After 30 days, deletion is permanent",
                        ]}
                        renderItem={(text) => <List.Item>{text}</List.Item>}
                      />
                    </Space>
                  }
                />

                <div style={{ marginTop: 16 }}>
                  <Button
                    danger
                    type="primary"
                    icon={<DeleteOutlined />}
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Delete My Account
                  </Button>
                </div>
              </Card>
            </Space>
          </Spin>
        </Space>

        <Modal
          title="Confirm Account Deletion"
          open={showDeleteModal}
          onOk={handleDeleteAccount}
          onCancel={() => {
            setShowDeleteModal(false);
            setDeleteReason("");
            setConfirmText("");
            setDeleteLoading(false);
          }}
          okText="Delete Account"
          cancelText="Cancel"
          okButtonProps={{
            danger: true,
            disabled: confirmText !== "DELETE" || deleteLoading,
            loading: deleteLoading,
          }}
          cancelButtonProps={{ disabled: deleteLoading }}
          maskClosable={!deleteLoading}
          closable={!deleteLoading}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            <Typography.Text>
              We're sorry to see you go! Before you delete your account, please
              tell us why:
            </Typography.Text>
            <Input.TextArea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Your feedback helps us improve (optional)"
              rows={3}
              disabled={deleteLoading}
            />
            <Alert
              type="error"
              showIcon
              message={
                <span>
                  To confirm deletion, type <b>DELETE</b> in the box below:
                </span>
              }
            />
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              disabled={deleteLoading}
              status={confirmText && confirmText !== "DELETE" ? "error" : ""}
            />
          </Space>
        </Modal>
      </div>
    </CustomerDashboardLayout>
  );
};

export default CustomerSettings;

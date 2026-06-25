import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import CustomerDashboardLayout from "./CustomerDashboardLayout";
import { API_BASE_URL } from "../../../config/env.js";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Form,
  Input,
  Space,
  Typography,
} from "antd";

const CustomerProfile = () => {
  const { user, token, updateUser, initializing } = useAuth();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  useEffect(() => {
    setFormData({
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: user?.phone || "",
    });
  }, [user]);

  useEffect(() => {
    profileForm.setFieldsValue(formData);
  }, [formData, profileForm]);

  useEffect(() => {
    if (initializing || !token) {
      return;
    }

    const controller = new AbortController();

    const fetchProfile = async () => {
      try {
        setIsProfileLoading(true);
        setProfileError("");

        const response = await fetch(`${API_BASE_URL}/api/customer/profile`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Failed to load profile");
        }

        const payload = await response.json();
        if (payload?.user) {
          updateUser(payload.user);
          setFormData({
            fullName: payload.user.fullName || "",
            email: payload.user.email || "",
            phone: payload.user.phone || "",
          });
        }
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }
        console.error("Failed to load customer profile", error);
        setProfileError(error.message || "Failed to load profile");
      } finally {
        setIsProfileLoading(false);
      }
    };

    fetchProfile();

    return () => controller.abort();
  }, [initializing, token, updateUser]);

  const handleSubmit = (values) => {
    const nextValues = {
      fullName: values?.fullName ?? formData.fullName,
      email: values?.email ?? formData.email,
      phone: values?.phone ?? formData.phone,
    };

    if (!token) {
      setProfileError("You must be logged in to update your profile.");
      setProfileSuccess("");
      return;
    }

    const trimmedFullName = (nextValues.fullName || "").trim();
    const trimmedEmail = (nextValues.email || "").trim();
    const trimmedPhone = (nextValues.phone || "").trim();

    if (!trimmedFullName) {
      setProfileError("Full name is required.");
      setProfileSuccess("");
      return;
    }

    if (!trimmedEmail) {
      setProfileError("Email is required.");
      setProfileSuccess("");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setProfileError("Please enter a valid email address.");
      setProfileSuccess("");
      return;
    }

    if (!trimmedPhone) {
      setProfileError("Phone number is required.");
      setProfileSuccess("");
      return;
    }

    const updateProfile = async () => {
      try {
        setIsProfileSaving(true);
        setProfileError("");
        setProfileSuccess("");

        const response = await fetch(`${API_BASE_URL}/api/customer/profile`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullName: trimmedFullName,
            email: trimmedEmail,
            phone: trimmedPhone,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Failed to update profile");
        }

        const payload = await response.json();
        if (payload?.user) {
          updateUser(payload.user);
          setFormData({
            fullName: payload.user.fullName || "",
            email: payload.user.email || "",
            phone: payload.user.phone || "",
          });
        }

        setProfileSuccess("Profile updated successfully!");
        setIsEditing(false);
      } catch (error) {
        console.error("Failed to update profile", error);
        setProfileError(error.message || "Failed to update profile");
      } finally {
        setIsProfileSaving(false);
      }
    };

    updateProfile();
  };

  const handlePasswordSubmit = (values) => {
    const nextPasswordData = {
      currentPassword: values?.currentPassword ?? passwordData.currentPassword,
      newPassword: values?.newPassword ?? passwordData.newPassword,
      confirmPassword: values?.confirmPassword ?? passwordData.confirmPassword,
    };

    if (nextPasswordData.newPassword !== nextPasswordData.confirmPassword) {
      setPasswordError("New password and confirm password do not match.");
      setPasswordSuccess("");
      return;
    }

    if ((nextPasswordData.newPassword || "").length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      setPasswordSuccess("");
      return;
    }

    if (!token) {
      setPasswordError("You must be logged in to update your password.");
      setPasswordSuccess("");
      return;
    }

    const updatePassword = async () => {
      try {
        setIsPasswordSaving(true);
        setPasswordError("");
        setPasswordSuccess("");

        const response = await fetch(
          `${API_BASE_URL}/api/customer/profile/password`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              currentPassword: nextPasswordData.currentPassword,
              newPassword: nextPasswordData.newPassword,
            }),
          }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "Failed to update password");
        }

        setPasswordSuccess("Password updated successfully!");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        passwordForm.resetFields();
        setIsEditingPassword(false);
      } catch (error) {
        console.error("Failed to update password", error);
        setPasswordError(error.message || "Failed to update password");
      } finally {
        setIsPasswordSaving(false);
      }
    };

    updatePassword();
  };

  const handleCancel = () => {
    setFormData({
      fullName: user?.fullName || "",
      email: user?.email || "",
      phone: user?.phone || "",
    });
    profileForm.resetFields();
    setIsEditing(false);
    setProfileError("");
    setProfileSuccess("");
  };

  return (
    <CustomerDashboardLayout title="Profile">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          {profileSuccess && (
            <Alert type="success" showIcon message={profileSuccess} />
          )}
          {profileError && (
            <Alert type="error" showIcon message={profileError} />
          )}
          {isProfileLoading && !profileError && (
            <Alert
              type="info"
              showIcon
              message="Loading latest profile information..."
            />
          )}

          <Card
            title={<Typography.Title level={3} style={{ margin: 0 }}>My Profile</Typography.Title>}
            extra={
              !isEditing ? (
                <Button
                  type="primary"
                  onClick={() => {
                    setIsEditing(true);
                    setProfileSuccess("");
                    setProfileError("");
                  }}
                  disabled={isProfileLoading}
                >
                  Edit Profile
                </Button>
              ) : null
            }
          >
            {!isEditing ? (
              <Descriptions column={1} size="middle">
                <Descriptions.Item label="Full Name">
                  {formData.fullName || "Not set"}
                </Descriptions.Item>
                <Descriptions.Item label="Email Address">
                  {formData.email || "Not set"}
                </Descriptions.Item>
                <Descriptions.Item label="Phone Number">
                  {formData.phone || "Not set"}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Form
                form={profileForm}
                layout="vertical"
                initialValues={formData}
                onFinish={handleSubmit}
                onValuesChange={(_, allValues) => {
                  setFormData((previous) => ({ ...previous, ...allValues }));
                }}
              >
                <Form.Item
                  label="Full Name"
                  name="fullName"
                  rules={[{ required: true, message: "Full name is required." }]}
                >
                  <Input disabled={isProfileSaving} placeholder="Enter your full name" />
                </Form.Item>

                <Form.Item
                  label="Email Address"
                  name="email"
                  rules={[
                    { required: true, message: "Email is required." },
                    { type: "email", message: "Please enter a valid email address." },
                  ]}
                >
                  <Input disabled={isProfileSaving} placeholder="Enter your email" />
                </Form.Item>

                <Form.Item
                  label="Phone Number"
                  name="phone"
                  rules={[{ required: true, message: "Phone number is required." }]}
                >
                  <Input disabled={isProfileSaving} placeholder="Enter your phone number" />
                </Form.Item>

                <Space>
                  <Button onClick={handleCancel} disabled={isProfileSaving}>
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit" loading={isProfileSaving}>
                    Save Changes
                  </Button>
                </Space>
              </Form>
            )}
          </Card>

          <Card
            title={<Typography.Title level={4} style={{ margin: 0 }}>Change Password</Typography.Title>}
            extra={
              !isEditingPassword ? (
                <Button
                  type="primary"
                  onClick={() => {
                    setIsEditingPassword(true);
                    setPasswordError("");
                    setPasswordSuccess("");
                  }}
                >
                  Change Password
                </Button>
              ) : null
            }
          >
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              {passwordSuccess && (
                <Alert type="success" showIcon message={passwordSuccess} />
              )}
              {passwordError && (
                <Alert type="error" showIcon message={passwordError} />
              )}

              {isEditingPassword ? (
                <Form
                  form={passwordForm}
                  layout="vertical"
                  initialValues={passwordData}
                  onFinish={handlePasswordSubmit}
                  onValuesChange={(_, allValues) => {
                    setPasswordData((previous) => ({ ...previous, ...allValues }));
                  }}
                >
                  <Form.Item
                    label="Current Password"
                    name="currentPassword"
                    rules={[{ required: true, message: "Current password is required." }]}
                  >
                    <Input.Password
                      disabled={isPasswordSaving}
                      placeholder="Enter current password"
                    />
                  </Form.Item>
                  <Form.Item
                    label="New Password"
                    name="newPassword"
                    rules={[
                      { required: true, message: "New password is required." },
                      { min: 8, message: "Password must be at least 8 characters long." },
                    ]}
                  >
                    <Input.Password
                      disabled={isPasswordSaving}
                      placeholder="Enter new password (min. 8 characters)"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Confirm New Password"
                    name="confirmPassword"
                    dependencies={["newPassword"]}
                    rules={[
                      { required: true, message: "Please confirm your new password." },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("newPassword") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(
                            new Error("New password and confirm password do not match.")
                          );
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      disabled={isPasswordSaving}
                      placeholder="Confirm new password"
                    />
                  </Form.Item>

                  <Space>
                    <Button
                      onClick={() => {
                        setIsEditingPassword(false);
                        setPasswordData({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        });
                        passwordForm.resetFields();
                        setPasswordError("");
                        setPasswordSuccess("");
                      }}
                      disabled={isPasswordSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={isPasswordSaving}
                    >
                      Update Password
                    </Button>
                  </Space>
                </Form>
              ) : (
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  Keep your account secure by regularly updating your password.
                </Typography.Paragraph>
              )}
            </Space>
          </Card>

          <Card title="Account Information">
            <Descriptions column={1} size="middle">
              <Descriptions.Item label="Account Type">
                {user?.role || "Customer"}
              </Descriptions.Item>
              <Descriptions.Item label="Member Since">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("id-ID")
                  : "N/A"}
              </Descriptions.Item>
            </Descriptions>
            <Divider style={{ marginBottom: 0 }} />
          </Card>
        </Space>
      </div>
    </CustomerDashboardLayout>
  );
};

export default CustomerProfile;

import { useEffect, useState } from "react";
import { Alert, Button, Form, Input, Modal, Typography } from "antd";

import { API_BASE_URL } from "../../../config/env.js";

const STEPS = {
  request: "request",
  verify: "verify",
  reset: "reset",
  success: "success",
};

const ForgotPasswordModal = ({ onClose }) =>{
  const [form] = Form.useForm();
  const [step, setStep] = useState(STEPS.request);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);

  const closeAndReset = () => {
    setStep(STEPS.request);
    setSubmitting(false);
    setError("");
    setInfo("");
    setEmail("");
    setResetToken(null);
    setExpiresAt(null);
    form.resetFields();
    onClose?.();
  };

  useEffect(() => {
    form.resetFields();
    setError("");
    setInfo("");
  }, [form, step]);

  const requestCode = async (values) => {
    setError("");
    setInfo("");

    const nextEmail = values?.email;
    if (!nextEmail) {
      setError("Email is required");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: nextEmail }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to send verification code");
      }

      setEmail(nextEmail);
      setInfo(data?.message || "Verification code sent via SMS");
      setStep(STEPS.verify);
    } catch (err) {
      setError(err?.message || "Failed to send verification code");
    } finally {
      setSubmitting(false);
    }
  };

  const verifyCode = async (values) => {
    setError("");
    setInfo("");

    const code = values?.code;
    if (!code) {
      setError("Verification code is required");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Invalid or expired verification code");
      }

      setResetToken(data.resetToken);
      setExpiresAt(data.expiresAt);
      setInfo("Phone number verified. You can now set a new password.");
      setStep(STEPS.reset);
    } catch (err) {
      setError(err?.message || "Failed to verify the provided code");
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (values) => {
    setError("");
    setInfo("");

    if (!resetToken) {
      setError("Verification is required before resetting password");
      setStep(STEPS.verify);
      return;
    }

    const password = values?.password;
    if (!password) {
      setError("Please enter your new password");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: resetToken, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || "Failed to reset password");
      }

      setStep(STEPS.success);
      setInfo(data?.message || "Password updated successfully");
      setTimeout(closeAndReset, 2000);
    } catch (err) {
      setError(err?.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    step === STEPS.request
      ? "Forgot password"
      : step === STEPS.verify
        ? "Verify code"
        : step === STEPS.reset
          ? "Reset password"
          : "Success";

  const renderContent = () => {
    switch (step) {
      case STEPS.request:
        return (
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={requestCode}
            disabled={submitting}
          >
            <Form.Item
              label="Registered Email"
              name="email"
              rules={[
                { required: true, message: "Email is required" },
                { type: "email", message: "Please enter a valid email" },
              ]}
            >
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Button htmlType="submit" type="primary" danger block loading={submitting}>
              Send Verification Code
            </Button>
          </Form>
        );
      case STEPS.verify:
        return (
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={verifyCode}
            disabled={submitting}
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              Enter the 6-digit code sent to the phone number linked with {email}.
            </Typography.Paragraph>
            <Form.Item
              label="Verification Code"
              name="code"
              rules={[{ required: true, message: "Verification code is required" }]}
            >
              <Input placeholder="123456" inputMode="numeric" autoComplete="one-time-code" />
            </Form.Item>
            <Button htmlType="submit" type="primary" danger block loading={submitting}>
              Verify Code
            </Button>
          </Form>
        );
      case STEPS.reset:
        return (
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={resetPassword}
            disabled={submitting}
          >
            {expiresAt && (
              <Typography.Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
                Token expires at {new Date(expiresAt).toLocaleTimeString()}
              </Typography.Text>
            )}
            <Form.Item
              label="New Password"
              name="password"
              rules={[
                { required: true, message: "Please enter your new password" },
                { min: 6, message: "Password must be at least 6 characters" },
              ]}
            >
              <Input.Password placeholder="Enter a new password" autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              label="Confirm Password"
              name="confirmPassword"
              dependencies={["password"]}
              rules={[
                { required: true, message: "Please confirm your new password" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("Passwords do not match"));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="Confirm your new password" autoComplete="new-password" />
            </Form.Item>
            <Button htmlType="submit" type="primary" danger block loading={submitting}>
              Update Password
            </Button>
          </Form>
        );
      case STEPS.success:
        return (
          <div style={{ display: "grid", gap: 12 }}>
            <Typography.Text>Password updated successfully.</Typography.Text>
            <Button type="primary" danger block onClick={closeAndReset}>
              Close
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      open
      title={title}
      onCancel={closeAndReset}
      footer={null}
      destroyOnClose
      maskClosable
    >
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      {info && <Alert type="success" showIcon message={info} style={{ marginBottom: 12 }} />}
      {renderContent()}
    </Modal>
  );
};

export default ForgotPasswordModal;
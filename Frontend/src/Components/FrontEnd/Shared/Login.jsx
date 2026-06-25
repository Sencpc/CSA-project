import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  ROLE_REDIRECTS,
  STORAGE_KEYS,
  useAuth,
} from "../../../context/AuthContext";
import LoadingScreen from "./LoadingScreen";
import logo from "../../../assets/SharedAsset/logo.png";
import ForgotPasswordModal from "./ForgotPasswordModal";
import {
  ArrowLeftOutlined,
  LockOutlined,
  MailOutlined,
} from "@ant-design/icons";
import { API_BASE_URL } from "../../../config/env.js";
import { Alert, Button, Card, Checkbox, Form, Input, Space, Typography } from "antd";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, user } = useAuth();
  const [form] = Form.useForm();
  const [apiError, setApiError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return Boolean(localStorage.getItem(STORAGE_KEYS.token));
  });
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const normalizedRole = user?.role?.toLowerCase?.();
      const targetRoute = ROLE_REDIRECTS[normalizedRole] || "/";
      if (location.pathname !== targetRoute) {
        navigate(targetRoute, { replace: true });
      }
      return;
    }

    if (!location.state) return;

    if (location.state.email) {
      form.setFieldsValue({ email: location.state.email });
    }

    if (location.state.registered) {
      setInfoMessage("Account created! Please sign in.");
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [form, isAuthenticated, location, navigate, user]);

  const handleSubmit = (values) => {
    const { email, password } = values;

    setApiError("");
    setInfoMessage("");

    const authenticate = async () => {
      try {
        setIsSubmitting(true);
        setShowLoading(true);

        // Minimum 2 second delay
        const startTime = Date.now();

        if (!API_BASE_URL) {
          throw new Error(
            "API endpoint not configured. Please set VITE_API_URL in your environment."
          );
        }

        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        let data = {};
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            data = await response.json();
          } catch (parseError) {
            data = {};
          }
        }

        if (!response.ok) {
          throw new Error(data?.message || "Failed to login");
        }

        // Wait for minimum 2 seconds
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, 2000 - elapsedTime);
        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        login({ token: data.token, user: data.user, rememberMe });

        const normalizedRole = data.user?.role?.toLowerCase?.();
        const targetRoute = ROLE_REDIRECTS[normalizedRole] || "/";
        navigate(targetRoute, { replace: true });
      } catch (error) {
        setApiError(error.message || "Failed to login");
        setShowLoading(false);
      } finally {
        setIsSubmitting(false);
      }
    };

    authenticate();
  };

  if (showLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center text-gray-600 hover:text-red-400 transition-colors duration-200"
        >
          <ArrowLeftOutlined className="mr-2" />
          <span className="font-medium">Back to Home</span>
        </Link>

        {/* Login Card */}
        <Card className="rounded-2xl shadow-2xl" styles={{ body: { padding: 32 } }}>
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img src={logo} alt="Logo" className="h-20 w-auto" />
            </div>
            <Typography.Title level={2} style={{ marginBottom: 4 }}>
              Welcome Back
            </Typography.Title>
            <Typography.Text type="secondary">
              Please sign in to your account
            </Typography.Text>
          </div>

          <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 24 }}>
            {apiError && <Alert type="error" showIcon message={apiError} />}
            {infoMessage && <Alert type="success" showIcon message={infoMessage} />}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
              disabled={isSubmitting}
            >
              <Form.Item
                label="Email Address"
                name="email"
                rules={[
                  { required: true, message: "Email is required" },
                  { type: "email", message: "Please enter a valid email" },
                ]}
              >
                <Input
                  size="large"
                  placeholder="Enter your email"
                  autoComplete="email"
                  prefix={<MailOutlined />}
                />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, message: "Password is required" },
                  {
                    min: 6,
                    message: "Password must be at least 6 characters",
                  },
                ]}
              >
                <Input.Password
                  size="large"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  prefix={<LockOutlined />}
                />
              </Form.Item>

              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <Checkbox
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                >
                  Remember me
                </Checkbox>

                <Button
                  type="link"
                  onClick={() => setShowForgotPassword(true)}
                  style={{ paddingInline: 0 }}
                >
                  Forgot password?
                </Button>
              </div>

              <Form.Item style={{ marginBottom: 12 }}>
                <Button
                  htmlType="submit"
                  type="primary"
                  danger
                  size="large"
                  block
                  loading={isSubmitting}
                >
                  Sign In
                </Button>
              </Form.Item>

              <div className="text-center">
                <Typography.Text type="secondary">
                  Don't have an account?{" "}
                  <Link to="/register" className="text-red-400 hover:text-red-500">
                    Sign up now
                  </Link>
                </Typography.Text>
              </div>
            </Form>
          </Space>
        </Card>

        {/* Footer Text */}
        <Typography.Text type="secondary" className="text-center block">
          © 2025 All rights reserved.
        </Typography.Text>
      </div>
      {showForgotPassword && (
        <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} />
      )}
    </div>
  );
};

export default Login;

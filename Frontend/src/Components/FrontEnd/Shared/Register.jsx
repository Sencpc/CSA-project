import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import LoadingScreen from "./LoadingScreen";
import logo from "../../../assets/SharedAsset/logo.png";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { API_BASE_URL } from "../../../config/env.js";
import { Alert, Button, Card, Checkbox, Form, Input, Space, Typography } from "antd";

const Register = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (values) => {
    setServerError("");
    setSuccessMessage("");

    setLoading(true);
    setShowLoading(true);

    try {
      // Minimum 2 second delay
      const startTime = Date.now();

      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          phone: values.phone,
          password: values.password,
        }),
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
        setServerError(data.message || "Failed to create account.");
        if (response.status === 409) {
          form.setFields([
            {
              name: "email",
              errors: [data.message || "Email is already registered."],
            },
          ]);
        }
        setShowLoading(false);
        return;
      }

      // Wait for minimum 2 seconds
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 2000 - elapsedTime);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));

      setSuccessMessage(
        data.message || "Account created successfully. Redirecting to login..."
      );
      form.resetFields();

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error) {
      console.error("Registration request failed", error);
      setServerError("Unable to reach the server. Please try again later.");
      setShowLoading(false);
    } finally {
      setLoading(false);
    }
  };

  if (showLoading) {
    return <LoadingScreen />;
  }

  const { Title, Text } = Typography;

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

        <Card className="rounded-2xl shadow-2xl" styles={{ body: { padding: 32 } }}>
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img src={logo} alt="Logo" className="h-20 w-auto" />
            </div>
            <Title level={2} style={{ marginBottom: 4 }}>
              Create Account
            </Title>
            <Text type="secondary">Sign up to get started</Text>
          </div>

          <Space direction="vertical" size="middle" style={{ width: "100%", marginTop: 24 }}>
            {serverError && <Alert type="error" showIcon message={serverError} />}
            {successMessage && <Alert type="success" showIcon message={successMessage} />}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              requiredMark={false}
              disabled={loading}
              initialValues={{
                fullName: "",
                email: "",
                phone: "",
                password: "",
                confirmPassword: "",
                terms: false,
              }}
            >
              <Form.Item
                label="Full Name"
                name="fullName"
                rules={[
                  { required: true, message: "Full name is required" },
                  {
                    validator: (_, value) => {
                      const v = (value || "").trim();
                      if (!v) return Promise.resolve();
                      if (v.length < 3) {
                        return Promise.reject(
                          new Error("Full name must be at least 3 characters")
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input size="large" placeholder="Enter your full name" />
              </Form.Item>

              <Form.Item
                label="Email Address"
                name="email"
                rules={[
                  { required: true, message: "Email is required" },
                  { type: "email", message: "Please enter a valid email" },
                ]}
              >
                <Input size="large" placeholder="Enter your email" autoComplete="email" />
              </Form.Item>

              <Form.Item
                label="Phone Number"
                name="phone"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) {
                        return Promise.reject(new Error("Phone number is required"));
                      }
                      const cleaned = String(value).replace(/[-\s]/g, "");
                      if (!/^[0-9]{10,13}$/.test(cleaned)) {
                        return Promise.reject(
                          new Error("Please enter a valid phone number (10-13 digits)")
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input size="large" placeholder="Enter your phone number" />
              </Form.Item>

              <Form.Item
                label="Password"
                name="password"
                rules={[
                  { required: true, message: "Password is required" },
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      if (String(value).length < 6) {
                        return Promise.reject(
                          new Error("Password must be at least 6 characters")
                        );
                      }
                      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(value)) {
                        return Promise.reject(
                          new Error(
                            "Password must contain uppercase, lowercase, and number"
                          )
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input.Password size="large" placeholder="Create a password" />
              </Form.Item>

              <Form.Item
                label="Confirm Password"
                name="confirmPassword"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "Please confirm your password" },
                  ({ getFieldValue }) => ({
                    validator: (_, value) => {
                      const password = getFieldValue("password");
                      if (!value || password === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error("Passwords do not match"));
                    },
                  }),
                ]}
              >
                <Input.Password size="large" placeholder="Confirm your password" />
              </Form.Item>

              <Form.Item
                name="terms"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value) => {
                      if (value) return Promise.resolve();
                      return Promise.reject(
                        new Error("You must agree to the terms and conditions")
                      );
                    },
                  },
                ]}
              >
                <Checkbox>
                  I agree to the <a href="#">Terms and Conditions</a> and{" "}
                  <a href="#">Privacy Policy</a>
                </Checkbox>
              </Form.Item>

              <Form.Item style={{ marginBottom: 8 }}>
                <Button
                  type="primary"
                  danger
                  htmlType="submit"
                  block
                  size="large"
                  loading={loading}
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </Form.Item>

              <div className="text-center">
                <Text type="secondary">
                  Already have an account?{" "}
                  <Link to="/login" className="text-red-400 hover:text-red-500">
                    Sign in here
                  </Link>
                </Text>
              </div>
            </Form>
          </Space>
        </Card>

        <Text type="secondary" className="text-center block">
          © 2025 All rights reserved.
        </Text>
      </div>
    </div>
  );
};

export default Register;

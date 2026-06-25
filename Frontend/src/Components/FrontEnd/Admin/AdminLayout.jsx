import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Layout, Space, Typography } from "antd";
import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";

import { useAuth } from "../../../context/AuthContext";
import Sidebar from "./Sidebar";
import logo from "../../../assets/SharedAsset/logo.png";

const { Header, Sider, Content } = Layout;

const AdminLayout = ({ children, title }) => {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = useMemo(() => {
    const fullName = user?.fullName || "Admin";
    return fullName;
  }, [user]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        width={260}
        collapsedWidth={80}
        collapsed={collapsed}
        trigger={null}
        breakpoint="lg"
        onBreakpoint={(broken) => {
          // On mobile/tablet: use drawer-like behaviour (collapsedWidth=0)
          if (broken) {
            setCollapsed(false);
            setMobileOpen(false);
          }
        }}
        style={{
          background: "#fff",
          borderRight: "1px solid rgba(5, 5, 5, 0.06)",
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "auto",
        }}
        className={mobileOpen ? "max-lg:!fixed max-lg:!z-50" : "max-lg:!hidden"}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            borderBottom: "1px solid rgba(5, 5, 5, 0.06)",
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
            }}
          >
            <img
              src={logo}
              alt="Flower Beauty Salon"
              style={{ width: 36, height: 36, borderRadius: 999 }}
            />
            {!collapsed && (
              <Typography.Text strong style={{ fontSize: 16 }}>
                Flower Beauty
              </Typography.Text>
            )}
          </Link>
        </div>

        <Sidebar
          collapsed={collapsed}
          onNavigate={() => {
            // close mobile sider after clicking
            setMobileOpen(false);
          }}
        />

        <div style={{ padding: 16, borderTop: "1px solid rgba(5, 5, 5, 0.06)" }}>
          <Button
            onClick={logout}
            danger
            type="primary"
            block
            icon={<LogoutOutlined />}
          >
            {!collapsed ? "Logout" : null}
          </Button>
        </div>
      </Sider>

      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 16px",
            borderBottom: "1px solid rgba(5, 5, 5, 0.06)",
            position: "sticky",
            top: 0,
            zIndex: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Space size={12} align="center">
            {/* Desktop collapse */}
            <Button
              type="text"
              className="hidden lg:inline-flex"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label="Toggle sidebar"
            />

            {/* Mobile open */}
            <Button
              type="text"
              className="lg:hidden"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
            />

            <Typography.Title level={4} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
          </Space>

          <Space size={12} align="center">
            <Typography.Text type="secondary">
              Welcome, {displayName}
            </Typography.Text>
            <Button
              className="lg:hidden"
              onClick={logout}
              danger
              type="primary"
              icon={<LogoutOutlined />}
            />
          </Space>
        </Header>

        <Content style={{ padding: 16 }}>
          {children}
        </Content>
      </Layout>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </Layout>
  );
};

export default AdminLayout;
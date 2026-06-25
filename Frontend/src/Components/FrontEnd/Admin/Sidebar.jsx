import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "antd";
import {
  AppstoreOutlined,
  BookOutlined,
  DashboardOutlined,
  SettingOutlined,
  TagOutlined,
  TransactionOutlined,
  UserOutlined,
} from "@ant-design/icons";

const Sidebar = ({ collapsed, onNavigate }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const items = useMemo(
    () => [
      {
        key: "/admin/dashboard",
        icon: <DashboardOutlined />,
        label: "Dashboard",
      },
      {
        key: "/admin/accounts",
        icon: <UserOutlined />,
        label: "Account Manage",
      },
      {
        key: "/admin/bookings",
        icon: <BookOutlined />,
        label: "Book Manage",
      },
      {
        key: "/admin/coupons",
        icon: <TagOutlined />,
        label: "Coupon Manage",
      },
      {
        key: "/admin/services",
        icon: <AppstoreOutlined />,
        label: "Service Manage",
      },
      {
        key: "/admin/transactions",
        icon: <TransactionOutlined />,
        label: "Transaction",
      },
      {
        key: "/admin/settings",
        icon: <SettingOutlined />,
        label: "Settings",
      },
    ],
    []
  );

  const selectedKey = useMemo(() => {
    const path = location.pathname;
    const match = items.find((item) => path.startsWith(item.key));
    return match ? [match.key] : [];
  }, [items, location.pathname]);

  return (
    <Menu
      mode="inline"
      items={items}
      selectedKeys={selectedKey}
      inlineCollapsed={collapsed}
      style={{ borderRight: 0 }}
      onClick={({ key }) => {
        navigate(key);
        onNavigate?.();
      }}
    />
  );
};

export default Sidebar;

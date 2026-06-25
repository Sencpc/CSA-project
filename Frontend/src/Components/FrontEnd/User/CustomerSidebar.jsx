import { useLocation, useNavigate } from "react-router-dom";
import { Drawer, Menu } from "antd";
import {
  DashboardOutlined,
  GiftOutlined,
  HistoryOutlined,
  LogoutOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAuth } from "../../../context/AuthContext";

const CustomerSidebar = ({ sidebarOpen, toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const items = [
    {
      key: "/customer/dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
    {
      key: "/customer/profile",
      icon: <UserOutlined />,
      label: "Profile",
    },
    {
      key: "/customer/coupon",
      icon: <GiftOutlined />,
      label: "Coupon",
    },
    {
      key: "/customer/history",
      icon: <HistoryOutlined />,
      label: "History",
    },
    {
      key: "/customer/cart",
      icon: <ShoppingCartOutlined />,
      label: "Cart",
    },
    {
      key: "/customer/settings",
      icon: <SettingOutlined />,
      label: "Settings",
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      danger: true,
    },
  ];

  const handleClick = ({ key }) => {
    if (key === "logout") {
      logout();
      toggleSidebar?.();
      return;
    }
    navigate(key);
    toggleSidebar?.();
  };

  return (
    <Drawer
      title="Menu"
      placement="left"
      open={Boolean(sidebarOpen)}
      onClose={toggleSidebar}
      width={260}
      styles={{ body: { padding: 0 } }}
    >
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={items}
        onClick={handleClick}
      />
    </Drawer>
  );
};

export default CustomerSidebar;

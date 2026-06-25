import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { Layout, Menu, theme, Button, ConfigProvider } from 'antd';
import { 
  DashboardOutlined, 
  UserOutlined, 
  GiftOutlined, 
  HistoryOutlined, 
  ShoppingCartOutlined, 
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const CustomerDashboardLayout = ({ children, title }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const menuItems = [
    {
      key: '/customer/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/customer/profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      key: '/customer/coupon',
      icon: <GiftOutlined />,
      label: 'Coupon',
    },
    {
      key: '/customer/history',
      icon: <HistoryOutlined />,
      label: 'History',
    },
    {
      key: '/customer/cart',
      icon: <ShoppingCartOutlined />,
      label: 'Cart',
    },
    {
      key: '/customer/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
    },
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      logout();
    } else {
      navigate(key);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#f87171', // red-400
          colorBgContainer: '#ffffff',
        },
        components: {
          Menu: {
            itemSelectedBg: '#fef2f2', // red-50
            itemSelectedColor: '#f87171', // red-400
          },
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Sider 
          trigger={null} 
          collapsible 
          collapsed={collapsed} 
          style={{ background: colorBgContainer }} 
          width={250}
        >
          <div className="flex items-center justify-center py-4">
             <h1 className={`text-xl font-bold text-red-400 transition-all duration-300 ${collapsed ? 'scale-0' : 'scale-100'}`}>
               Flower Beauty
             </h1>
          </div>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>
        <Layout>
          <Header style={{ padding: 0, background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 64,
                height: 64,
              }}
            />
            <div className="flex items-center mr-6 gap-4">
               <span className="text-gray-600 font-medium">Welcome, {user?.fullName || "Customer"}</span>
               <Link to="/">
                  <Button icon={<HomeOutlined />} type="primary" danger shape="circle" />
               </Link>
            </div>
          </Header>
          <Content
            style={{
              margin: '24px 16px',
              padding: 24,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
            {children}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default CustomerDashboardLayout;

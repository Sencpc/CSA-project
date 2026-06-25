import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import logo from "../../../assets/SharedAsset/logo.png";
import { Button, Drawer, Space, Typography } from "antd";
import { HomeOutlined } from "@ant-design/icons";

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const linkStyle = useMemo(
    () => ({
      color: "#1f2937",
      fontWeight: 600,
      fontSize: "18px",
      display: "inline-flex",
      alignItems: "center",
      lineHeight: 1,
      transition: "all 0.3s ease",
    }),
    []
  );

  const navItems = useMemo(
    () => [
      {
        key: "home",
        label: "Home",
        to: "/",
        icon: <HomeOutlined style={{ marginRight: 8 }} />,
      },
      { key: "blog", label: "Blog", to: "/blog" },
      {
        key: "services",
        label: "Services",
        to: isAuthenticated ? "/customer/book" : "/book",
      },
      {
        key: "about",
        label: "About Us",
        to: isAuthenticated ? "/customer/about" : "/about",
      },
    ],
    [isAuthenticated]
  );

  const NavLinks = ({ direction = "horizontal" }) => (
    <Space direction={direction} size={direction === "horizontal" ? 24 : 16}>
      {navItems.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          onClick={() => setIsOpen(false)}
          style={linkStyle}
        >
          {item.icon || null}
          {item.label}
        </Link>
      ))}
    </Space>
  );

  return (
    <div className="my-3">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <nav className="container mx-auto px-6 py-2">
          <div className="flex justify-between items-center">
            {/* Logo/Brand */}
            <Link to="/" className="flex items-center space-x-3">
              <img
                src={logo}
                alt="Flower Beauty Salon Logo"
                className="h-12 w-12 object-cover rounded-full"
              />
              <span className="text-2xl font-bold bg-red-300 bg-clip-text text-transparent">
                Flower Beauty Salon
              </span>
            </Link>

            {/* Desktop Navigation Menu */}
            <ul className="hidden md:flex space-x-6 items-center relative top-2">
              <li style={{ listStyle: "none" }}>
                <NavLinks />
              </li>

              {isAuthenticated ? (
                <>
                  <li className="relative group">
                    <Link
                      to="/customer/profile"
                      className="text-gray-800 font-semibold text-lg flex items-center gap-2 transition-all duration-300 ease-in-out hover:text-red-400"
                    >
                      <svg
                        className="w-5 h-5 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span>Hi, {user?.fullName?.split(" ")[0] || "Guest"}</span>
                    </Link>
                  </li>
                  <li className="ml-4">
                    <Button
                      onClick={logout}
                      type="primary"
                      danger
                      className="relative overflow-hidden font-bold px-8 py-3 rounded-full transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:shadow-red-500/30 group cursor-pointer border-none h-auto"
                    >
                      <span className="relative z-10">Log out</span>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </Button>
                  </li>
                </>
              ) : (
                <li>
                  <Link to="/login">
                    <Button
                      type="primary"
                      danger
                      className="relative overflow-hidden font-bold px-8 py-3 rounded-full transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-2xl hover:shadow-red-500/30 group cursor-pointer border-none h-auto"
                    >
                      <span className="relative z-10">Login</span>
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </Button>
                  </Link>
                </li>
              )}
            </ul>

            {/* Mobile: Hamburger */}
            <div className="md:hidden flex items-center">
              <Button
                type="text"
                onClick={() => setIsOpen(true)}
                aria-label="Open menu"
                className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-300"
                icon={
                  <svg
                    className="w-6 h-6 text-gray-800"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        </nav>
      </header>

      <Drawer
        open={isOpen}
        placement="right"
        width={288}
        onClose={() => setIsOpen(false)}
        closable={false}
        styles={{ body: { padding: 24 } }}
      >
        <div className="flex items-center justify-between mb-6">
          <Link to="/" onClick={() => setIsOpen(false)} className="flex items-center space-x-3">
            <img src={logo} alt="Logo" className="h-10 w-10 object-cover rounded-full" />
            <Typography.Text strong style={{ fontSize: 16 }}>
              Flower Beauty
            </Typography.Text>
          </Link>
          <Button
            type="text"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
            className="p-2 rounded-md"
            icon={
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            }
          />
        </div>

        <ul className="space-y-4">
          <li style={{ listStyle: "none" }}>
            <NavLinks direction="vertical" />
          </li>

          {isAuthenticated ? (
            <>
              <li>
                <Link
                  to="/customer/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 text-gray-800"
                >
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Hi, {user?.fullName?.split(" ")[0] || "Guest"}</span>
                </Link>
              </li>
              <li>
                <Button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  block
                  type="primary"
                  danger
                  className="w-full text-left font-bold px-4 py-3 rounded-full h-auto border-none"
                >
                  Log out
                </Button>
              </li>
            </>
          ) : (
            <li>
              <Link to="/login" onClick={() => setIsOpen(false)}>
                <Button
                  type="primary"
                  danger
                  className="w-full text-left font-bold px-4 py-3 rounded-full h-auto border-none"
                  block
                >
                  Login
                </Button>
              </Link>
            </li>
          )}
        </ul>
      </Drawer>
    </div>
  );
};

export default Navbar;

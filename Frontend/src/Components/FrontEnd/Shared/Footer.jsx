import { Typography } from "antd";

const Footer = () => {
  return (
    <footer className="bg-black text-white py-8 px-6">
      <div className="container mx-auto">
        <div className="flex items-center justify-between gap-6">
          {/* Logo Section */}
          <div className="flex-shrink-0">
            <div className="text-3xl font-bold text-red-300 mr-4">
              <Typography.Text style={{ color: "inherit" , fontSize: "2rem"}}>FBS</Typography.Text>
            </div>
          </div>

          {/* Copyright / Info */}
          <div className="text-xs sm:text-sm text-gray-400 text-right flex-1 min-w-0 footer-info">
            <Typography.Text style={{ color: "inherit" }}>
              ©2025 Flower Beauty Salon. All rights reserved.
            </Typography.Text>
            <div className="mt-1">
              <Typography.Text style={{ color: "inherit" }}>
                No part of this website may be reproduced without permission.
              </Typography.Text>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

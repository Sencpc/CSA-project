import CustomerDashboardLayout from "./CustomerDashboardLayout";
import CouponIcon from "../../../assets/SharedAsset/Coupon.png";
import {
  Badge,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";

const CustomerCoupon = () => {
  const coupons = [
    {
      id: 1,
      type: "SURPRISE",
      discount: "SURPRISE",
      description: "Get a surprise discount on your next visit!",
      code: "SURPRISE2025",
      validUntil: "Dec 31, 2025",
      usageLimit: 1,
      usedCount: 1,
    },
    {
      id: 2,
      type: "WELCOME COUPON",
      discount: "30% OFF",
      description: "Welcome! Enjoy 30% off on your first salon service",
      code: "WELCOME30",
      validUntil: "Nov 30, 2025",
      usageLimit: 5,
      usedCount: 2,
    },
    {
      id: 3,
      type: "SEASONAL PROMO",
      discount: "25% OFF",
      description: "Celebrate the season with amazing discounts",
      code: "HOLIDAY25",
      validUntil: "Dec 25, 2025",
      usageLimit: 3,
      usedCount: 1,
    },
    {
      id: 4,
      type: "LOYALTY REWARD",
      discount: "40% OFF",
      description:
        "Thank you for your loyalty! Special discount for VIP members",
      code: "VIP40",
      validUntil: "Dec 31, 2025",
      usageLimit: 2,
      usedCount: 2,
    },
    {
      id: 5,
      type: "REFERRAL BONUS",
      discount: "20% OFF",
      description: "Share the love! Get 20% off when you refer a friend",
      code: "REFER20",
      validUntil: "Jan 15, 2026",
      usageLimit: null,
      usedCount: 3,
    },
  ];

  const redeemedCoupons = coupons.filter(
    (coupon) => (coupon.usedCount ?? 0) > 0
  );

  return (
    <CustomerDashboardLayout title="My Coupons">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Redeemed Coupons
        </Typography.Title>

        {redeemedCoupons.length === 0 ? (
          <Card>
            <Empty description="You have not redeemed any coupons yet." />
          </Card>
        ) : (
          <List
            itemLayout="vertical"
            dataSource={redeemedCoupons}
            renderItem={(coupon) => {
              const usageLimit = coupon.usageLimit ?? null;
              const usedCount = coupon.usedCount ?? 0;
              const isFullyUsed =
                typeof usageLimit === "number" && usageLimit >= 0
                  ? usedCount >= usageLimit
                  : false;

              const percent =
                typeof usageLimit === "number" && usageLimit > 0
                  ? Math.min((usedCount / usageLimit) * 100, 100)
                  : 0;

              const content = (
                <Card>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={6}>
                      <img
                        src={CouponIcon}
                        alt="Coupon Icon"
                        style={{ width: "100%", maxWidth: 180 }}
                      />
                    </Col>
                    <Col xs={24} md={18}>
                      <Space direction="vertical" size="small" style={{ width: "100%" }}>
                        <Space wrap>
                          <Tag color="orange">{coupon.type}</Tag>
                          {isFullyUsed && <Tag color="red">USED</Tag>}
                        </Space>

                        <Typography.Title level={2} style={{ margin: 0 }}>
                          {coupon.discount}
                        </Typography.Title>
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                          {coupon.description}
                        </Typography.Paragraph>

                        <Descriptions size="small" column={2}>
                          <Descriptions.Item label="Coupon Code">
                            <Typography.Text code>{coupon.code}</Typography.Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="Valid Until">
                            {coupon.validUntil}
                          </Descriptions.Item>
                        </Descriptions>

                        {usageLimit !== null ? (
                          <Space direction="vertical" size={4} style={{ width: "100%" }}>
                            <Typography.Text type={isFullyUsed ? "danger" : "success"}>
                              {isFullyUsed
                                ? `Usage limit reached (${usedCount}/${usageLimit})`
                                : `${Math.max(usageLimit - usedCount, 0)} use(s) remaining (${usedCount}/${usageLimit})`}
                            </Typography.Text>
                            <Progress percent={percent} status={isFullyUsed ? "exception" : "active"} />
                          </Space>
                        ) : (
                          <Typography.Text type="secondary">
                            Used {usedCount} time{usedCount === 1 ? "" : "s"} (no usage limit)
                          </Typography.Text>
                        )}
                      </Space>
                    </Col>
                  </Row>
                </Card>
              );

              return (
                <List.Item key={coupon.id}>
                  {isFullyUsed ? (
                    <Badge.Ribbon text="USED" color="red">
                      {content}
                    </Badge.Ribbon>
                  ) : (
                    content
                  )}
                </List.Item>
              );
            }}
          />
        )}
      </Space>
    </CustomerDashboardLayout>
  );
};

export default CustomerCoupon;

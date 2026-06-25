import { useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Row,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import { CalendarOutlined, ClockCircleOutlined, ReadOutlined } from '@ant-design/icons';

const Blog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = [
    'All',
    'Hair Care',
    'Hair Trends',
    'Styling Tips',
    'Product Reviews',
    'Hair Health',
    'Tutorials'
  ];

  const blogPosts = [
    {
      id: 1,
      title: "10 Essential Tips for Healthy Hair Care",
      excerpt: "Learn the fundamental practices to maintain strong, shiny, and healthy hair. From proper washing techniques to the right products for your hair type.",
      category: "Hair Care",
      author: "Dr. Sarah Johnson",
      date: "Oct 25, 2025",
      readTime: "5 min read",
      image: "hair-care-tips.jpg",
      tags: ["Hair Care", "Tips", "Health"],
      relatedPosts: [2, 5, 6]
    },
    {
      id: 2,
      title: "2025 Hair Color Trends You Need to Try",
      excerpt: "Discover the hottest hair color trends of 2025, from bold vibrant shades to subtle natural tones that are taking the beauty world by storm.",
      category: "Hair Trends",
      author: "Emily Chen",
      date: "Oct 23, 2025",
      readTime: "7 min read",
      image: "color-trends.jpg",
      tags: ["Trends", "Color", "Style"],
      relatedPosts: [3, 7, 8]
    },
    {
      id: 3,
      title: "How to Style Beach Waves at Home",
      excerpt: "Master the art of creating perfect beach waves with our step-by-step tutorial. Get that effortless, tousled look without visiting the salon.",
      category: "Tutorials",
      author: "Lisa Martinez",
      date: "Oct 20, 2025",
      readTime: "6 min read",
      image: "beach-waves.jpg",
      tags: ["Tutorial", "Styling", "DIY"],
      relatedPosts: [4, 9, 10]
    },
    {
      id: 4,
      title: "The Ultimate Guide to Hair Straightening",
      excerpt: "Everything you need to know about hair straightening methods, from temporary styling to permanent treatments. Find the best option for you.",
      category: "Styling Tips",
      author: "Amanda White",
      date: "Oct 18, 2025",
      readTime: "8 min read",
      image: "straightening.jpg",
      tags: ["Styling", "Tutorial", "Tips"],
      relatedPosts: [3, 11, 12]
    },
    {
      id: 5,
      title: "Best Hair Masks for Damaged Hair",
      excerpt: "Repair and restore your damaged hair with these highly effective hair masks. Natural and commercial options reviewed.",
      category: "Product Reviews",
      author: "Jessica Lee",
      date: "Oct 15, 2025",
      readTime: "5 min read",
      image: "hair-masks.jpg",
      tags: ["Products", "Hair Care", "Reviews"],
      relatedPosts: [1, 6, 13]
    },
    {
      id: 6,
      title: "Understanding Hair Porosity and Its Impact",
      excerpt: "Learn about hair porosity and how it affects your hair care routine. Discover the best products for your porosity type.",
      category: "Hair Health",
      author: "Dr. Maria Rodriguez",
      date: "Oct 12, 2025",
      readTime: "6 min read",
      image: "hair-porosity.jpg",
      tags: ["Health", "Science", "Hair Care"],
      relatedPosts: [1, 5, 14]
    },
    {
      id: 7,
      title: "Balayage vs Ombre: Which is Right for You?",
      excerpt: "Confused about balayage and ombre? We break down the differences and help you choose the perfect coloring technique.",
      category: "Hair Trends",
      author: "Sophie Turner",
      date: "Oct 10, 2025",
      readTime: "5 min read",
      image: "balayage-ombre.jpg",
      tags: ["Trends", "Color", "Guide"],
      relatedPosts: [2, 8, 15]
    },
    {
      id: 8,
      title: "Trending Short Hairstyles for 2025",
      excerpt: "Bold, chic, and absolutely stunning - explore the short hairstyles that are dominating 2025's fashion scene.",
      category: "Hair Trends",
      author: "Alex Kim",
      date: "Oct 8, 2025",
      readTime: "6 min read",
      image: "short-styles.jpg",
      tags: ["Trends", "Short Hair", "Style"],
      relatedPosts: [2, 7, 16]
    },
    {
      id: 9,
      title: "Step-by-Step Braiding Techniques",
      excerpt: "From simple three-strand braids to intricate Dutch and French braids, master all braiding techniques with our detailed guide.",
      category: "Tutorials",
      author: "Rachel Green",
      date: "Oct 5, 2025",
      readTime: "10 min read",
      image: "braiding.jpg",
      tags: ["Tutorial", "Braids", "Styling"],
      relatedPosts: [3, 10, 17]
    },
    {
      id: 10,
      title: "How to Create the Perfect Updo",
      excerpt: "Elegant updos for every occasion. Learn professional techniques to create stunning updo hairstyles at home.",
      category: "Tutorials",
      author: "Monica Geller",
      date: "Oct 3, 2025",
      readTime: "7 min read",
      image: "updo.jpg",
      tags: ["Tutorial", "Updo", "Formal"],
      relatedPosts: [3, 9, 18]
    }
  ];

  const filteredPosts = blogPosts.filter(post => {
    const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getRelatedPosts = (relatedIds) => {
    return blogPosts.filter(post => relatedIds.includes(post.id)).slice(0, 3);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-pink-100 to-rose-50 pt-20">
      <div className="bg-gradient-to-r from-pink-300 to-rose-300 text-white py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <Typography.Title level={1} style={{ color: 'white', margin: 0 }}>
            Beauty & Hair Blog
          </Typography.Title>
          <Typography.Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 18 }}>
            Your ultimate guide to hair care, trends, and styling tips
          </Typography.Paragraph>

          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <Input.Search
              allowClear
              size="large"
              placeholder="Search articles, tips, tutorials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md sticky top-0 z-40 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Space align="center" wrap>
            <Typography.Text strong>Categories:</Typography.Text>
            <Segmented
              options={categories}
              value={selectedCategory}
              onChange={setSelectedCategory}
            />
          </Space>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <Typography.Paragraph style={{ marginBottom: 16 }}>
          Showing{' '}
          <Typography.Text strong>{filteredPosts.length}</Typography.Text>{' '}
          article{filteredPosts.length !== 1 ? 's' : ''}
          {searchQuery ? ` for "${searchQuery}"` : ''}
        </Typography.Paragraph>

        {filteredPosts.length === 0 ? (
          <Empty
            description="No articles found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Row gutter={[16, 16]}>
            {filteredPosts.map((post) => {
              const initials = post.author
                .split(' ')
                .map((n) => n[0])
                .join('');

              return (
                <Col key={post.id} xs={24} md={12} lg={8}>
                  <Card
                    hoverable
                    cover={
                      <div
                        style={{
                          height: 220,
                          background: 'linear-gradient(135deg, #fbcfe8, #fecdd3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ReadOutlined style={{ fontSize: 56, color: 'rgba(255,255,255,0.7)' }} />
                      </div>
                    }
                  >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Tag color="magenta">{post.category}</Tag>

                      <Space size="middle" wrap>
                        <Space size={6}>
                          <CalendarOutlined />
                          <Typography.Text type="secondary">{post.date}</Typography.Text>
                        </Space>
                        <Space size={6}>
                          <ClockCircleOutlined />
                          <Typography.Text type="secondary">{post.readTime}</Typography.Text>
                        </Space>
                      </Space>

                      <Typography.Title level={4} style={{ marginTop: 4, marginBottom: 0 }}>
                        {post.title}
                      </Typography.Title>
                      <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>
                        {post.excerpt}
                      </Typography.Paragraph>

                      <Space wrap>
                        {post.tags.map((tag) => (
                          <Tag key={`${post.id}-${tag}`}>#{tag}</Tag>
                        ))}
                      </Space>

                      <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Space>
                          <Avatar style={{ backgroundColor: '#fb7185' }}>{initials}</Avatar>
                          <Typography.Text>{post.author}</Typography.Text>
                        </Space>
                        <Button type="link">Read More</Button>
                      </Space>

                      <div>
                        <Typography.Text strong>Related Articles</Typography.Text>
                        <List
                          size="small"
                          dataSource={getRelatedPosts(post.relatedPosts)}
                          renderItem={(relatedPost) => (
                            <List.Item key={relatedPost.id} style={{ paddingLeft: 0, paddingRight: 0 }}>
                              <Typography.Link href="#" style={{ width: '100%' }}>
                                {relatedPost.title}
                              </Typography.Link>
                            </List.Item>
                          )}
                        />
                      </div>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {filteredPosts.length > 0 && (
          <div className="text-center mt-12">
            <Button size="large" type="primary">
              Load More Articles
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Blog;

// src/config/dynamo.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const REGION = process.env.AWS_REGION || "us-east-1";
const FRIEND_ACCOUNT_ID = process.env.FRIEND_ACCOUNT_ID; 

// Initialize client using your native LabRole
const baseClient = new DynamoDBClient({ region: REGION });
export const dynamoDB = DynamoDBDocumentClient.from(baseClient);

// Helper function to build cross-account ARNs automatically using exact lowercase bindings
const getTableArn = (tableName) => {
  return `arn:aws:dynamodb:${REGION}:${FRIEND_ACCOUNT_ID}:table/${tableName}`;
};

export const TABLES = {
  BLOG_POSTS: getTableArn(process.env.BLOG_POSTS_TABLE) || getTableArn("blogposts"),
  BOOKINGS: getTableArn(process.env.BOOKINGS_TABLE) || getTableArn("bookings"),
  CATEGORIES: getTableArn(process.env.CATEGORIES_TABLE) || getTableArn("categories"),
  COUPONS: getTableArn(process.env.COUPONS_TABLE) || getTableArn("coupons"),
  GALLERY_ITEMS: getTableArn(process.env.GALLERY_ITEMS_TABLE) || getTableArn("galleryitems"),
  NOTIFICATIONS: getTableArn(process.env.NOTIFICATIONS_TABLE) || getTableArn("notifications"),
  REVIEWS: getTableArn(process.env.REVIEWS_TABLE) || getTableArn("reviews"),
  SERVICES: getTableArn(process.env.SERVICES_TABLE) || getTableArn("services"),
  TRANSACTIONS: getTableArn(process.env.TRANSACTIONS_TABLE) || getTableArn("transactions"),
  USERS: getTableArn(process.env.USERS_TABLE) || getTableArn("users"),
  SETTINGS: getTableArn(process.env.SETTINGS_TABLE) || getTableArn("settings"),
};
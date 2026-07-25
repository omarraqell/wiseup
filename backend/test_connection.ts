import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Testing connection with DATABASE_URL:", process.env.DATABASE_URL);
  try {
    const categoriesCount = await prisma.category.count();
    console.log("✅ Successfully connected! Category count:", categoriesCount);
    const productsCount = await prisma.product.count();
    console.log("✅ Product count:", productsCount);
  } catch (error) {
    console.error("❌ Failed to connect to the database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

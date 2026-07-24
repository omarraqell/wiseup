import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

async function main() {
  console.log("🌱 Starting database seeding...");

  // Define paths to current JSON data files
  const categoriesPath = path.join(__dirname, "../../data/categories.json");
  const productsPath = path.join(__dirname, "../../products.json");

  if (!fs.existsSync(categoriesPath)) {
    throw new Error(`Categories file not found at ${categoriesPath}`);
  }
  if (!fs.existsSync(productsPath)) {
    throw new Error(`Products file not found at ${productsPath}`);
  }

  // Load and parse categories
  const rawCategories = JSON.parse(fs.readFileSync(categoriesPath, "utf-8"));
  console.log(`Loaded ${rawCategories.length} categories from categories.json`);

  // Load and parse products
  const rawProducts = JSON.parse(fs.readFileSync(productsPath, "utf-8"));
  console.log(`Loaded ${rawProducts.length} products from products.json`);

  // Clear existing data to allow fresh seeding
  console.log("Cleaning existing products and categories...");
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});

  // Seed Categories
  console.log("Seeding categories...");
  let sortOrder = 1;
  const categoryIdMap = new Map<number, boolean>();

  for (const cat of rawCategories) {
    const slug = slugify(cat.name_en || `category-${cat.id}`);
    await prisma.category.create({
      data: {
        id: cat.id,
        nameAr: cat.name_ar,
        nameEn: cat.name_en || "",
        slug: slug,
        sourceUrl: cat.url || null,
        sortOrder: sortOrder++,
      },
    });
    categoryIdMap.set(cat.id, true);
  }
  console.log("Categories seeded successfully.");

  // Seed Products
  console.log("Seeding products...");
  let seededProductsCount = 0;
  for (const prod of rawProducts) {
    if (!prod.code) {
      console.warn(`Skipping product with missing code: ${JSON.stringify(prod)}`);
      continue;
    }

    const codeStr = String(prod.code).trim();
    
    // Ensure the category exists in DB (or set categoryId to null/undefined)
    const categoryId = prod.category_id && categoryIdMap.has(prod.category_id)
      ? prod.category_id
      : null;

    // Standardize image path
    const imageUrl = prod.image ? `/${prod.image.replace(/\\/g, "/").replace(/^\/+/, "")}` : null;

    await prisma.product.upsert({
      where: { code: codeStr },
      update: {},
      create: {
        code: codeStr,
        nameAr: prod.name_ar,
        nameEn: prod.name_en || null,
        unit: prod.unit || "pcs",
        priceJod: prod.price_jod || 0.0,
        imageUrl: imageUrl,
        categoryId: categoryId,
        isActive: true,
      },
    });
    seededProductsCount++;
  }

  console.log(`Seeded ${seededProductsCount} products successfully.`);
  console.log("✨ Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

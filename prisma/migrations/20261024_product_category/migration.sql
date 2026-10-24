ALTER TABLE "Product" ADD COLUMN "category" TEXT;
CREATE INDEX "Product_category_idx" ON "Product"("category");

/*
  Warnings:

  - A unique constraint covering the columns `[label]` on the table `Category` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Category_label_key" ON "Category"("label");


CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');


CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'WAITING_PROCESS', 'PROCESSED', 'CANCELED', 'COMPLETED');


ALTER TABLE "Order" DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT';


ALTER TABLE "OrderItem" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;


CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
INSERT INTO "User" ("id", "name", "email", "password", "role", "updatedAt") 
VALUES (
    'admin-default-uuid-1234', 
    'Admin - DakenShop', 
    'admin@dakenshop.com', 
    '$2b$10$wIe16yv3GstI4Wq9g77v7Ounm0gO8K0b6qGZ9z7xP6BwR93Hh2FpG', 
    'ADMIN', 
    CURRENT_TIMESTAMP
);
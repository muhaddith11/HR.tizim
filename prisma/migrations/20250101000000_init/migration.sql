CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "hrBotToken" TEXT,
    "hrAdminChatId" TEXT,
    "officeLat" DOUBLE PRECISION,
    "officeLon" DOUBLE PRECISION,
    "officeRadius" DOUBLE PRECISION NOT NULL DEFAULT 150,
    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pendingAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3),
    "checkOut" TIMESTAMP(3),
    "checkInLat" DOUBLE PRECISION,
    "checkInLon" DOUBLE PRECISION,
    "checkOutLat" DOUBLE PRECISION,
    "checkOutLon" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Employee_telegramId_key" ON "Employee"("telegramId");

ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

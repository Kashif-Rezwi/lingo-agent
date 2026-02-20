-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "locales" TEXT[],
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "prUrl" TEXT,
    "previewUrl" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizedPhone" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "codeVerification" TEXT NOT NULL,
    "lastCodeVerificationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizedPhone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizedPhone_phone_key" ON "AuthorizedPhone"("phone");

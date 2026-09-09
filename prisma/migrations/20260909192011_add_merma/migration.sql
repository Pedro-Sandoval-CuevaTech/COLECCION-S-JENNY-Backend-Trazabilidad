-- CreateTable
CREATE TABLE "Merma" (
    "id" SERIAL NOT NULL,
    "loteDetalleId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merma_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Merma" ADD CONSTRAINT "Merma_loteDetalleId_fkey" FOREIGN KEY ("loteDetalleId") REFERENCES "LoteDetalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

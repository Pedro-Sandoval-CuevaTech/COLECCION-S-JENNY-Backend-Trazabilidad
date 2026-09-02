-- CreateTable
CREATE TABLE "TipoTela" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoTela_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoTela_nombre_key" ON "TipoTela"("nombre");

-- Seed a placeholder type for rows that existed before TipoTela existed, so the
-- new NOT NULL columns below have something to point to.
INSERT INTO "TipoTela" ("nombre") VALUES ('Sin especificar');

-- AlterTable: add nullable, backfill existing rows to the placeholder, then enforce NOT NULL
ALTER TABLE "Tela" ADD COLUMN "tipoTelaId" INTEGER;
UPDATE "Tela" SET "tipoTelaId" = (SELECT "id" FROM "TipoTela" WHERE "nombre" = 'Sin especificar');
ALTER TABLE "Tela" ALTER COLUMN "tipoTelaId" SET NOT NULL;

ALTER TABLE "Lote" ADD COLUMN "tipoTelaId" INTEGER;
UPDATE "Lote" SET "tipoTelaId" = (SELECT "id" FROM "TipoTela" WHERE "nombre" = 'Sin especificar');
ALTER TABLE "Lote" ALTER COLUMN "tipoTelaId" SET NOT NULL;

-- CreateTable
CREATE TABLE "LoteTela" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "telaId" INTEGER NOT NULL,
    "metros" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "LoteTela_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Tela" ADD CONSTRAINT "Tela_tipoTelaId_fkey" FOREIGN KEY ("tipoTelaId") REFERENCES "TipoTela"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_tipoTelaId_fkey" FOREIGN KEY ("tipoTelaId") REFERENCES "TipoTela"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteTela" ADD CONSTRAINT "LoteTela_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteTela" ADD CONSTRAINT "LoteTela_telaId_fkey" FOREIGN KEY ("telaId") REFERENCES "Tela"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

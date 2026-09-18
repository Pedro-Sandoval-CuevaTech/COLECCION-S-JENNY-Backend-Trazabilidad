-- Las ventas dejan de depender de un lote especifico: se registran y descuentan
-- del stock agregado por producto+talla en cada tienda (StockTienda).

-- CreateTable
CREATE TABLE "StockTienda" (
    "id" SERIAL NOT NULL,
    "productoId" INTEGER NOT NULL,
    "talla" TEXT NOT NULL,
    "tiendaId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StockTienda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockTienda_productoId_talla_tiendaId_key" ON "StockTienda"("productoId", "talla", "tiendaId");

-- AddForeignKey
ALTER TABLE "StockTienda" ADD CONSTRAINT "StockTienda_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTienda" ADD CONSTRAINT "StockTienda_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Poblar StockTienda con el stock ya transferido a tiendas (LoteTienda), agregado por producto+talla.
INSERT INTO "StockTienda" ("productoId", "talla", "tiendaId", "cantidad")
SELECT l."productoId", ld."talla", lt."tiendaId", SUM(lt."cantidad")
FROM "LoteTienda" lt
JOIN "LoteDetalle" ld ON ld."id" = lt."loteDetalleId"
JOIN "Lote" l ON l."id" = ld."loteId"
WHERE lt."cantidad" > 0
GROUP BY l."productoId", ld."talla", lt."tiendaId";

-- DropForeignKey
ALTER TABLE "Venta" DROP CONSTRAINT "Venta_loteDetalleId_fkey";

-- AlterTable: Venta pasa a referenciar producto+talla en vez de loteDetalleId
ALTER TABLE "Venta" ADD COLUMN "productoId" INTEGER;
ALTER TABLE "Venta" ADD COLUMN "talla" TEXT;
ALTER TABLE "Venta" DROP COLUMN "loteDetalleId";
ALTER TABLE "Venta" ALTER COLUMN "productoId" SET NOT NULL;
ALTER TABLE "Venta" ALTER COLUMN "talla" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

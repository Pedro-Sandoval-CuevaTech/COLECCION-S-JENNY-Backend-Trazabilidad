-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('CORTE', 'COSTURA', 'ACABADO', 'ALMACEN', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "TipoLote" AS ENUM ('STOCK', 'PEDIDO');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('CORTADOR', 'COSTURA', 'ACABADO', 'ALMACEN', 'VENDEDOR');

-- CreateTable
CREATE TABLE "Tela" (
    "id" SERIAL NOT NULL,
    "proveedor" TEXT NOT NULL,
    "metrosIngresados" DECIMAL(65,30) NOT NULL,
    "metrosDisponibles" DECIMAL(65,30) NOT NULL,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "productoId" INTEGER NOT NULL,
    "metrosTelaUsados" DECIMAL(65,30) NOT NULL,
    "estado" "EstadoLote" NOT NULL DEFAULT 'CORTE',
    "tipo" "TipoLote" NOT NULL DEFAULT 'STOCK',
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCostura" TIMESTAMP(3),
    "fechaAcabado" TIMESTAMP(3),
    "fechaAlmacen" TIMESTAMP(3),
    "fechaFinalizacion" TIMESTAMP(3),

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteDetalle" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "talla" TEXT NOT NULL,
    "cantidadInicial" INTEGER NOT NULL,
    "stockAlmacen" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LoteDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tienda" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Tienda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteTienda" (
    "loteDetalleId" INTEGER NOT NULL,
    "tiendaId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LoteTienda_pkey" PRIMARY KEY ("loteDetalleId","tiendaId")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "telefono" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "tiendaId" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("telefono")
);

-- CreateTable
CREATE TABLE "Transferencia" (
    "id" SERIAL NOT NULL,
    "loteDetalleId" INTEGER NOT NULL,
    "tiendaId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transferencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" SERIAL NOT NULL,
    "loteDetalleId" INTEGER NOT NULL,
    "tiendaId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Producto_nombre_key" ON "Producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Lote_codigo_key" ON "Lote"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "LoteDetalle_loteId_talla_key" ON "LoteDetalle"("loteId", "talla");

-- CreateIndex
CREATE UNIQUE INDEX "Tienda_nombre_key" ON "Tienda"("nombre");

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteDetalle" ADD CONSTRAINT "LoteDetalle_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteTienda" ADD CONSTRAINT "LoteTienda_loteDetalleId_fkey" FOREIGN KEY ("loteDetalleId") REFERENCES "LoteDetalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteTienda" ADD CONSTRAINT "LoteTienda_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_loteDetalleId_fkey" FOREIGN KEY ("loteDetalleId") REFERENCES "LoteDetalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transferencia" ADD CONSTRAINT "Transferencia_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_loteDetalleId_fkey" FOREIGN KEY ("loteDetalleId") REFERENCES "LoteDetalle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venta" ADD CONSTRAINT "Venta_tiendaId_fkey" FOREIGN KEY ("tiendaId") REFERENCES "Tienda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

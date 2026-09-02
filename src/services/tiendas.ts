import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type Tx = Prisma.TransactionClient | typeof prisma;

// Las tiendas son un catalogo fijo (no se crean desde el chat), asi que no hace falta
// normalizar el nombre guardado — solo que la busqueda ignore mayusculas/minusculas.
export async function buscarTiendaPorNombre(nombre: string, tx: Tx = prisma) {
  return tx.tienda.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
}

export async function listarTiendas() {
  return prisma.tienda.findMany({ orderBy: { id: 'asc' } });
}

export async function obtenerStockDeTiendas() {
  const tiendas = await prisma.tienda.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      loteTiendas: {
        where: { cantidad: { gt: 0 } },
        include: {
          loteDetalle: {
            include: { lote: { include: { producto: true } } },
          },
        },
      },
    },
  });

  return tiendas.map((t) => {
    const porLote = new Map<
      string,
      { codigo: string; producto: string; tallas: { talla: string; cantidad: number }[] }
    >();
    let totalUnidades = 0;

    for (const lt of t.loteTiendas) {
      const codigo = lt.loteDetalle.lote.codigo;
      const producto = lt.loteDetalle.lote.producto.nombre;
      if (!porLote.has(codigo)) {
        porLote.set(codigo, { codigo, producto, tallas: [] });
      }
      porLote.get(codigo)!.tallas.push({
        talla: lt.loteDetalle.talla,
        cantidad: lt.cantidad,
      });
      totalUnidades += lt.cantidad;
    }

    const lotes = Array.from(porLote.values())
      .map((g) => ({
        ...g,
        tallas: g.tallas.sort((a, b) => a.talla.localeCompare(b.talla)),
      }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo));

    return { tienda: t.nombre, totalUnidades, lotes };
  });
}

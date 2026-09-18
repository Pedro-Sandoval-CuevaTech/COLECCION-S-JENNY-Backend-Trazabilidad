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

// El stock visible por tienda es el agregado por producto+talla (StockTienda): a la
// tienda no le importa de que lote vino la prenda, solo cuanto tiene de cada cosa.
export async function obtenerStockDeTiendas() {
  const tiendas = await prisma.tienda.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      stockTiendas: {
        where: { cantidad: { gt: 0 } },
        include: { producto: true },
      },
    },
  });

  return tiendas.map((t) => {
    const porProducto = new Map<
      string,
      { producto: string; cantidad: number; tallas: { talla: string; cantidad: number }[] }
    >();
    let totalUnidades = 0;

    for (const st of t.stockTiendas) {
      const producto = st.producto.nombre;
      if (!porProducto.has(producto)) {
        porProducto.set(producto, { producto, cantidad: 0, tallas: [] });
      }
      const g = porProducto.get(producto)!;
      g.tallas.push({ talla: st.talla, cantidad: st.cantidad });
      g.cantidad += st.cantidad;
      totalUnidades += st.cantidad;
    }

    const productos = Array.from(porProducto.values())
      .map((g) => ({
        ...g,
        tallas: g.tallas.sort((a, b) => a.talla.localeCompare(b.talla)),
      }))
      .sort((a, b) => a.producto.localeCompare(b.producto));

    return { tienda: t.nombre, totalUnidades, productos };
  });
}

import { prisma } from '../lib/prisma';
import { BusinessError } from '../errors';
import { requirePositiveInt, requireString } from '../lib/validators';
import { buscarProductoPorNombre, normalizarNombreProducto } from './productos';
import { buscarTiendaPorNombre } from './tiendas';

export async function venderProducto(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const nombreTienda = requireString(body.tienda, 'tienda');
  const nombreProducto = normalizarNombreProducto(body.producto);
  const talla = requireString(body.talla, 'talla');
  const cantidad = requirePositiveInt(body.cantidad, 'cantidad');

  return prisma.$transaction(async (tx) => {
    const tienda = await buscarTiendaPorNombre(nombreTienda, tx);
    if (!tienda) {
      throw new BusinessError(
        404,
        `La tienda "${nombreTienda}" no está registrada. Usa "Ver tiendas" para ver las tiendas disponibles.`
      );
    }

    const producto = await buscarProductoPorNombre(nombreProducto, tx);
    if (!producto) {
      throw new BusinessError(
        404,
        `El producto "${nombreProducto}" no está registrado. Usa "Ver productos" para ver los disponibles.`
      );
    }

    const stock = await tx.stockTienda.findUnique({
      where: {
        productoId_talla_tiendaId: { productoId: producto.id, talla, tiendaId: tienda.id },
      },
    });
    if (!stock || stock.cantidad < cantidad) {
      throw new BusinessError(
        400,
        `Stock insuficiente de "${nombreProducto}" talla ${talla} en la tienda "${nombreTienda}": disponibles ${stock?.cantidad ?? 0}, solicitados ${cantidad}`
      );
    }

    await tx.stockTienda.update({
      where: {
        productoId_talla_tiendaId: { productoId: producto.id, talla, tiendaId: tienda.id },
      },
      data: { cantidad: { decrement: cantidad } },
    });

    return tx.venta.create({
      data: { productoId: producto.id, talla, tiendaId: tienda.id, cantidad },
      include: { producto: true, tienda: true },
    });
  });
}

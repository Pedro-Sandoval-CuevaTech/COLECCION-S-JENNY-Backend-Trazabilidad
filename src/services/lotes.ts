import { EstadoLote, Prisma, Rol, TipoLote } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BusinessError } from '../errors';
import {
  requirePositiveInt,
  requirePositiveNumber,
  requireString,
  requireTallasArray,
  requireUsuarioConRol,
} from '../lib/validators';

const AVANCES: Partial<Record<Rol, { from: EstadoLote; to: EstadoLote }>> = {
  [Rol.CORTADOR]: { from: EstadoLote.CORTE, to: EstadoLote.COSTURA },
  [Rol.COSTURA]: { from: EstadoLote.COSTURA, to: EstadoLote.ACABADO },
  [Rol.ACABADO]: { from: EstadoLote.ACABADO, to: EstadoLote.ALMACEN },
};

function parseTipo(v: unknown): TipoLote {
  if (v === TipoLote.STOCK || v === TipoLote.PEDIDO) return v;
  throw new BusinessError(400, 'tipo debe ser "STOCK" o "PEDIDO"');
}

function parseEstado(v: unknown): EstadoLote {
  const values = Object.values(EstadoLote);
  if (typeof v === 'string' && (values as string[]).includes(v)) {
    return v as EstadoLote;
  }
  throw new BusinessError(400, `estado inválido; debe ser uno de ${values.join(', ')}`);
}

async function generarCodigo(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LOTE-${year}-`;
  // ponytail: race si dos POST /lotes coinciden en el mismo tick; el @unique en codigo devuelve 409.
  // Upgrade: tabla de secuencias o SELECT ... FOR UPDATE si hay concurrencia real.
  const count = await tx.lote.count({ where: { codigo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
}

export async function crearLote(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  await requireUsuarioConRol(body.telefono, Rol.CORTADOR);
  const nombreProducto = requireString(body.producto, 'producto');
  const metrosTela = requirePositiveNumber(body.metrosTela, 'metrosTela');
  const tallas = requireTallasArray(body.tallas);
  const tipo = body.tipo === undefined ? TipoLote.STOCK : parseTipo(body.tipo);

  return prisma.$transaction(async (tx) => {
    const producto = await tx.producto.findUnique({ where: { nombre: nombreProducto } });
    if (!producto) {
      throw new BusinessError(404, `Producto "${nombreProducto}" no existe`);
    }

    const telas = await tx.tela.findMany({
      where: { metrosDisponibles: { gt: 0 } },
      orderBy: { fechaIngreso: 'asc' },
    });
    let restante = metrosTela;
    for (const tela of telas) {
      if (restante <= 0) break;
      const disponible = Number(tela.metrosDisponibles);
      const usar = Math.min(disponible, restante);
      await tx.tela.update({
        where: { id: tela.id },
        data: { metrosDisponibles: { decrement: usar } },
      });
      restante -= usar;
    }
    if (restante > 0.0000001) {
      throw new BusinessError(
        400,
        `No hay suficiente tela disponible: faltan ${restante.toFixed(2)} metros para cubrir ${metrosTela}`
      );
    }

    const codigo = await generarCodigo(tx);
    return tx.lote.create({
      data: {
        codigo,
        productoId: producto.id,
        metrosTelaUsados: metrosTela,
        estado: EstadoLote.CORTE,
        tipo,
        detalles: {
          create: tallas.map((t) => ({
            talla: t.talla,
            cantidadInicial: t.cantidad,
          })),
        },
      },
      include: { detalles: true, producto: true },
    });
  });
}

export async function avanzarLote(codigo: string, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const telefono = requireString(body.telefono, 'telefono');

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUnique({ where: { telefono } });
    if (!usuario) throw new BusinessError(404, `Usuario con teléfono ${telefono} no existe`);

    const transicion = AVANCES[usuario.rol];
    if (!transicion) {
      throw new BusinessError(
        400,
        `Rol ${usuario.rol} no realiza avances de producción. Use los endpoints de transferencia o venta si corresponde.`
      );
    }

    const lote = await tx.lote.findUnique({ where: { codigo } });
    if (!lote) throw new BusinessError(404, `Lote ${codigo} no existe`);

    if (lote.estado !== transicion.from) {
      throw new BusinessError(
        400,
        `El lote ${codigo} está en estado ${lote.estado}; el rol ${usuario.rol} solo avanza desde ${transicion.from}`
      );
    }

    if (transicion.to === EstadoLote.ALMACEN) {
      // Inicializa stockAlmacen por talla al valor producido
      await tx.$executeRaw`UPDATE "LoteDetalle" SET "stockAlmacen" = "cantidadInicial" WHERE "loteId" = ${lote.id}`;
    }

    const now = new Date();
    const timestampUpdate =
      transicion.to === EstadoLote.COSTURA
        ? { fechaCostura: now }
        : transicion.to === EstadoLote.ACABADO
          ? { fechaAcabado: now }
          : { fechaAlmacen: now };

    return tx.lote.update({
      where: { id: lote.id },
      data: { estado: transicion.to, ...timestampUpdate },
      include: { detalles: true },
    });
  });
}

export async function transferirLote(codigo: string, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const nombreTienda = requireString(body.tienda, 'tienda');
  const talla = requireString(body.talla, 'talla');
  const cantidad = requirePositiveInt(body.cantidad, 'cantidad');

  return prisma.$transaction(async (tx) => {
    await requireUsuarioConRol(body.telefono, Rol.ALMACEN, tx);

    const tienda = await tx.tienda.findUnique({ where: { nombre: nombreTienda } });
    if (!tienda) throw new BusinessError(404, `Tienda "${nombreTienda}" no existe`);

    const lote = await tx.lote.findUnique({ where: { codigo } });
    if (!lote) throw new BusinessError(404, `Lote ${codigo} no existe`);
    if (lote.estado !== EstadoLote.ALMACEN) {
      throw new BusinessError(
        400,
        `El lote ${codigo} está en estado ${lote.estado}; debe estar en ALMACEN para transferir`
      );
    }

    const detalle = await tx.loteDetalle.findUnique({
      where: { loteId_talla: { loteId: lote.id, talla } },
    });
    if (!detalle) {
      throw new BusinessError(404, `El lote ${codigo} no tiene la talla "${talla}"`);
    }
    if (detalle.stockAlmacen < cantidad) {
      throw new BusinessError(
        400,
        `Stock insuficiente en almacén para talla ${talla}: disponibles ${detalle.stockAlmacen}, solicitados ${cantidad}`
      );
    }

    await tx.loteDetalle.update({
      where: { id: detalle.id },
      data: { stockAlmacen: { decrement: cantidad } },
    });

    await tx.loteTienda.upsert({
      where: { loteDetalleId_tiendaId: { loteDetalleId: detalle.id, tiendaId: tienda.id } },
      update: { cantidad: { increment: cantidad } },
      create: { loteDetalleId: detalle.id, tiendaId: tienda.id, cantidad },
    });

    return tx.transferencia.create({
      data: { loteDetalleId: detalle.id, tiendaId: tienda.id, cantidad },
    });
  });
}

export async function venderLote(codigo: string, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const talla = requireString(body.talla, 'talla');
  const cantidad = requirePositiveInt(body.cantidad, 'cantidad');

  return prisma.$transaction(async (tx) => {
    const usuario = await requireUsuarioConRol(body.telefono, Rol.VENDEDOR, tx);
    if (usuario.tiendaId == null) {
      throw new BusinessError(400, `El vendedor ${usuario.telefono} no tiene tienda asignada`);
    }

    const lote = await tx.lote.findUnique({ where: { codigo } });
    if (!lote) throw new BusinessError(404, `Lote ${codigo} no existe`);

    const detalle = await tx.loteDetalle.findUnique({
      where: { loteId_talla: { loteId: lote.id, talla } },
    });
    if (!detalle) {
      throw new BusinessError(404, `El lote ${codigo} no tiene la talla "${talla}"`);
    }

    const stockTienda = await tx.loteTienda.findUnique({
      where: {
        loteDetalleId_tiendaId: { loteDetalleId: detalle.id, tiendaId: usuario.tiendaId },
      },
    });
    if (!stockTienda || stockTienda.cantidad < cantidad) {
      throw new BusinessError(
        400,
        `Stock insuficiente del lote ${codigo} talla ${talla} en la tienda: disponibles ${stockTienda?.cantidad ?? 0}, solicitados ${cantidad}`
      );
    }

    await tx.loteTienda.update({
      where: {
        loteDetalleId_tiendaId: { loteDetalleId: detalle.id, tiendaId: usuario.tiendaId },
      },
      data: { cantidad: { decrement: cantidad } },
    });

    const venta = await tx.venta.create({
      data: { loteDetalleId: detalle.id, tiendaId: usuario.tiendaId, cantidad },
    });

    // Auto-finalización solo para STOCK cuando el lote (todas sus tallas) queda en 0
    if (lote.tipo === TipoLote.STOCK && lote.estado !== EstadoLote.FINALIZADO) {
      const [sumAlmacen, sumTiendas] = await Promise.all([
        tx.loteDetalle.aggregate({
          where: { loteId: lote.id },
          _sum: { stockAlmacen: true },
        }),
        tx.loteTienda.aggregate({
          where: { loteDetalle: { loteId: lote.id } },
          _sum: { cantidad: true },
        }),
      ]);
      const total = (sumAlmacen._sum.stockAlmacen ?? 0) + (sumTiendas._sum.cantidad ?? 0);
      if (total === 0) {
        await tx.lote.update({
          where: { id: lote.id },
          data: { estado: EstadoLote.FINALIZADO, fechaFinalizacion: new Date() },
        });
      }
    }

    return venta;
  });
}

export async function finalizarLote(codigo: string, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;

  return prisma.$transaction(async (tx) => {
    await requireUsuarioConRol(body.telefono, Rol.ALMACEN, tx);
    const lote = await tx.lote.findUnique({ where: { codigo } });
    if (!lote) throw new BusinessError(404, `Lote ${codigo} no existe`);
    if (lote.tipo !== TipoLote.PEDIDO) {
      throw new BusinessError(
        400,
        `Solo lotes de tipo PEDIDO pueden finalizarse manualmente; este es ${lote.tipo}`
      );
    }
    if (lote.estado === EstadoLote.FINALIZADO) {
      throw new BusinessError(400, `El lote ${codigo} ya está FINALIZADO`);
    }
    return tx.lote.update({
      where: { id: lote.id },
      data: { estado: EstadoLote.FINALIZADO, fechaFinalizacion: new Date() },
    });
  });
}

export async function listarLotes(input: unknown) {
  const query = (input ?? {}) as Record<string, unknown>;
  const estado = query.estado === undefined ? undefined : parseEstado(query.estado);
  const tipo = query.tipo === undefined ? undefined : parseTipo(query.tipo);

  const lotes = await prisma.lote.findMany({
    where: { estado, tipo },
    orderBy: { fechaCreacion: 'desc' },
    include: {
      producto: { select: { nombre: true } },
      detalles: { select: { cantidadInicial: true } },
    },
  });

  return lotes.map((l) => ({
    codigo: l.codigo,
    producto: l.producto.nombre,
    estado: l.estado,
    tipo: l.tipo,
    unidadesTotales: l.detalles.reduce((s, d) => s + d.cantidadInicial, 0),
    fechaCreacion: l.fechaCreacion,
    fechaFinalizacion: l.fechaFinalizacion,
  }));
}

export async function obtenerLote(codigo: string) {
  const lote = await prisma.lote.findUnique({
    where: { codigo },
    include: {
      producto: true,
      detalles: {
        orderBy: { talla: 'asc' },
        include: {
          loteTiendas: { include: { tienda: true } },
          transferencias: { include: { tienda: true }, orderBy: { fecha: 'asc' } },
          ventas: { include: { tienda: true }, orderBy: { fecha: 'asc' } },
        },
      },
    },
  });
  if (!lote) throw new BusinessError(404, `Lote ${codigo} no existe`);

  return {
    codigo: lote.codigo,
    producto: lote.producto.nombre,
    estado: lote.estado,
    tipo: lote.tipo,
    metrosTelaUsados: lote.metrosTelaUsados,
    fechaCreacion: lote.fechaCreacion,
    fechaFinalizacion: lote.fechaFinalizacion,
    detalleTallas: lote.detalles.map((d) => ({
      talla: d.talla,
      cantidadInicial: d.cantidadInicial,
      stockAlmacen: d.stockAlmacen,
      stocksEnTiendas: d.loteTiendas.map((lt) => ({
        tienda: lt.tienda.nombre,
        cantidad: lt.cantidad,
      })),
      transferencias: d.transferencias.map((t) => ({
        tienda: t.tienda.nombre,
        cantidad: t.cantidad,
        fecha: t.fecha,
      })),
      ventas: d.ventas.map((v) => ({
        tienda: v.tienda.nombre,
        cantidad: v.cantidad,
        fecha: v.fecha,
      })),
    })),
  };
}

import { EstadoLote, Prisma, TipoLote } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BusinessError } from '../errors';
import {
  requirePositiveInt,
  requirePositiveNumber,
  requireString,
  requireTallasArray,
} from '../lib/validators';
import { buscarProductoPorNombre, normalizarNombreProducto } from './productos';
import { buscarTiendaPorNombre } from './tiendas';
import { buscarTipoTelaPorNombre, normalizarNombreTipoTela } from './tiposTela';

const SIGUIENTE_ESTADO: Partial<Record<EstadoLote, EstadoLote>> = {
  [EstadoLote.CORTE]: EstadoLote.COSTURA,
  [EstadoLote.COSTURA]: EstadoLote.ACABADO,
  [EstadoLote.ACABADO]: EstadoLote.ALMACEN,
};

function parseTipo(v: unknown): TipoLote {
  const upper = typeof v === 'string' ? v.toUpperCase() : v;
  if (upper === TipoLote.STOCK || upper === TipoLote.PEDIDO) return upper;
  throw new BusinessError(400, 'tipo debe ser "STOCK" o "PEDIDO"');
}

function parseEstado(v: unknown): EstadoLote {
  const values = Object.values(EstadoLote);
  const upper = typeof v === 'string' ? v.toUpperCase() : v;
  if (typeof upper === 'string' && (values as string[]).includes(upper)) {
    return upper as EstadoLote;
  }
  throw new BusinessError(400, `estado inválido; debe ser uno de ${values.join(', ')}`);
}

// Si un lote en ALMACEN se queda sin stock en almacen (todas sus tallas en 0), ya no
// tiene nada pendiente por transferir/perder desde ahi y se da por finalizado. No mira
// el stock en tiendas (StockTienda) porque eso ya no es responsabilidad del lote.
async function finalizarSiAlmacenVacio(tx: Prisma.TransactionClient, loteId: number) {
  const lote = await tx.lote.findUniqueOrThrow({ where: { id: loteId } });
  if (lote.estado !== EstadoLote.ALMACEN) return;

  const suma = await tx.loteDetalle.aggregate({
    where: { loteId },
    _sum: { stockAlmacen: true },
  });
  if ((suma._sum.stockAlmacen ?? 0) === 0) {
    await tx.lote.update({
      where: { id: loteId },
      data: { estado: EstadoLote.FINALIZADO, fechaFinalizacion: new Date() },
    });
  }
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
  const nombreProducto = normalizarNombreProducto(body.producto);
  const nombreTipoTela = normalizarNombreTipoTela(body.tipoTela);
  const metrosTela = requirePositiveNumber(body.metrosTela, 'metrosTela');
  const tallas = requireTallasArray(body.tallas);
  const tipo = body.tipo === undefined ? TipoLote.STOCK : parseTipo(body.tipo);

  return prisma.$transaction(async (tx) => {
    const producto = await buscarProductoPorNombre(nombreProducto, tx);
    if (!producto) {
      throw new BusinessError(
        404,
        `El producto "${nombreProducto}" no está registrado. Antes de crear un lote, el producto debe existir en el catálogo — usa "Ver productos" para ver los disponibles.`
      );
    }

    const tipoTela = await buscarTipoTelaPorNombre(nombreTipoTela, tx);
    if (!tipoTela) {
      throw new BusinessError(
        404,
        `El tipo de tela "${nombreTipoTela}" no está registrado. Usa "Ver tipos de tela" para ver los disponibles.`
      );
    }

    // FIFO, pero solo dentro del tipo de tela pedido — nunca se descuenta tela de otro
    // tipo aunque haya disponible, para que quede explícito de qué tela sale cada lote.
    const telas = await tx.tela.findMany({
      where: { tipoTelaId: tipoTela.id, metrosDisponibles: { gt: 0 } },
      orderBy: { fechaIngreso: 'asc' },
    });
    let restante = metrosTela;
    const consumos: { telaId: number; metros: number }[] = [];
    for (const tela of telas) {
      if (restante <= 0) break;
      const disponible = Number(tela.metrosDisponibles);
      const usar = Math.min(disponible, restante);
      await tx.tela.update({
        where: { id: tela.id },
        data: { metrosDisponibles: { decrement: usar } },
      });
      consumos.push({ telaId: tela.id, metros: usar });
      restante -= usar;
    }
    if (restante > 0.0000001) {
      throw new BusinessError(
        400,
        `No hay suficiente tela "${tipoTela.nombre}" disponible: faltan ${restante.toFixed(2)} metros para cubrir ${metrosTela}`
      );
    }

    const codigo = await generarCodigo(tx);
    const lote = await tx.lote.create({
      data: {
        codigo,
        productoId: producto.id,
        tipoTelaId: tipoTela.id,
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
      include: { detalles: true, producto: true, tipoTela: true },
    });

    await tx.loteTela.createMany({
      data: consumos.map((c) => ({ loteId: lote.id, telaId: c.telaId, metros: c.metros })),
    });

    return lote;
  });
}

export async function avanzarLote(codigo: string) {
  return prisma.$transaction(async (tx) => {
    const lote = await tx.lote.findUnique({ where: { codigo } });
    if (!lote) {
      throw new BusinessError(
        404,
        `No encontré ningún lote con el código "${codigo}". Revisa que esté bien escrito (formato LOTE-AAAA-NNNN) o usa "Ver lotes" para ver los códigos existentes.`
      );
    }

    const siguiente = SIGUIENTE_ESTADO[lote.estado];
    if (!siguiente) {
      const sugerencia =
        lote.estado === EstadoLote.ALMACEN
          ? ' Ya está en ALMACEN — la siguiente acción es "Transferir a tienda" o "Registrar venta", no un avance de estado.'
          : '';
      throw new BusinessError(
        400,
        `El lote ${codigo} ya está en estado ${lote.estado} y no tiene un siguiente avance automático.${sugerencia}`
      );
    }

    if (siguiente === EstadoLote.ALMACEN) {
      // Inicializa stockAlmacen por talla al valor producido
      await tx.$executeRaw`UPDATE "LoteDetalle" SET "stockAlmacen" = "cantidadInicial" WHERE "loteId" = ${lote.id}`;
    }

    const now = new Date();
    const timestampUpdate =
      siguiente === EstadoLote.COSTURA
        ? { fechaCostura: now }
        : siguiente === EstadoLote.ACABADO
          ? { fechaAcabado: now }
          : { fechaAlmacen: now };

    return tx.lote.update({
      where: { id: lote.id },
      data: { estado: siguiente, ...timestampUpdate },
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
    const tienda = await buscarTiendaPorNombre(nombreTienda, tx);
    if (!tienda) {
      throw new BusinessError(
        404,
        `La tienda "${nombreTienda}" no está registrada. Usa "Ver tiendas" para ver las tiendas disponibles.`
      );
    }

    const lote = await tx.lote.findUnique({ where: { codigo } });
    if (!lote) {
      throw new BusinessError(
        404,
        `No encontré ningún lote con el código "${codigo}". Revisa que esté bien escrito (formato LOTE-AAAA-NNNN) o usa "Ver lotes" para ver los códigos existentes.`
      );
    }
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
      throw new BusinessError(
        404,
        `El lote ${codigo} no tiene registrada la talla "${talla}". Usa "Detalle de un lote" para ver qué tallas tiene.`
      );
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
    await finalizarSiAlmacenVacio(tx, lote.id);

    await tx.loteTienda.upsert({
      where: { loteDetalleId_tiendaId: { loteDetalleId: detalle.id, tiendaId: tienda.id } },
      update: { cantidad: { increment: cantidad } },
      create: { loteDetalleId: detalle.id, tiendaId: tienda.id, cantidad },
    });

    // Stock agregado disponible para venta en la tienda: no distingue de que lote vino.
    await tx.stockTienda.upsert({
      where: {
        productoId_talla_tiendaId: { productoId: lote.productoId, talla, tiendaId: tienda.id },
      },
      update: { cantidad: { increment: cantidad } },
      create: { productoId: lote.productoId, talla, tiendaId: tienda.id, cantidad },
    });

    return tx.transferencia.create({
      data: { loteDetalleId: detalle.id, tiendaId: tienda.id, cantidad },
    });
  });
}

export async function finalizarLote(codigo: string) {
  return prisma.$transaction(async (tx) => {
    const lote = await tx.lote.findUnique({ where: { codigo } });
    if (!lote) {
      throw new BusinessError(
        404,
        `No encontré ningún lote con el código "${codigo}". Revisa que esté bien escrito (formato LOTE-AAAA-NNNN) o usa "Ver lotes" para ver los códigos existentes.`
      );
    }
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
      tipoTela: { select: { nombre: true } },
      detalles: { select: { cantidadInicial: true } },
    },
  });

  return lotes.map((l) => ({
    codigo: l.codigo,
    producto: l.producto.nombre,
    tipoTela: l.tipoTela.nombre,
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
      tipoTela: true,
      consumosTela: { include: { tela: true }, orderBy: { id: 'asc' } },
      detalles: {
        orderBy: { talla: 'asc' },
        include: {
          loteTiendas: { include: { tienda: true } },
          transferencias: { include: { tienda: true }, orderBy: { fecha: 'asc' } },
          mermas: { orderBy: { fecha: 'asc' } },
        },
      },
    },
  });
  if (!lote) {
    throw new BusinessError(
      404,
      `No encontré ningún lote con el código "${codigo}". Revisa que esté bien escrito (formato LOTE-AAAA-NNNN) o usa "Ver lotes" para ver los códigos existentes.`
    );
  }

  return {
    codigo: lote.codigo,
    producto: lote.producto.nombre,
    estado: lote.estado,
    tipo: lote.tipo,
    metrosTelaUsados: lote.metrosTelaUsados,
    tipoTela: lote.tipoTela.nombre,
    origenTela: lote.consumosTela.map((c) => ({
      telaId: c.telaId,
      proveedor: c.tela.proveedor,
      fechaIngreso: c.tela.fechaIngreso,
      metrosUsados: c.metros,
    })),
    fechaCreacion: lote.fechaCreacion,
    fechaFinalizacion: lote.fechaFinalizacion,
    detalleTallas: lote.detalles.map((d) => ({
      talla: d.talla,
      cantidadInicial: d.cantidadInicial,
      stockAlmacen: d.stockAlmacen,
      // Acumulado historico transferido de este lote a cada tienda; las ventas ya no se
      // descuentan de aqui (se descuentan del stock agregado por producto+talla en StockTienda),
      // asi que este numero no baja al vender.
      transferidoATiendas: d.loteTiendas.map((lt) => ({
        tienda: lt.tienda.nombre,
        cantidad: lt.cantidad,
      })),
      transferencias: d.transferencias.map((t) => ({
        tienda: t.tienda.nombre,
        cantidad: t.cantidad,
        fecha: t.fecha,
      })),
      mermas: d.mermas.map((m) => ({
        cantidad: m.cantidad,
        motivo: m.motivo,
        fecha: m.fecha,
      })),
    })),
  };
}

export async function registrarMerma(codigo: string, input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const talla = requireString(body.talla, 'talla');
  const cantidad = requirePositiveInt(body.cantidad, 'cantidad');
  const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : null;

  return prisma.$transaction(async (tx) => {
    const lote = await tx.lote.findUnique({ where: { codigo } });
    if (!lote) {
      throw new BusinessError(
        404,
        `No encontré ningún lote con el código "${codigo}". Revisa que esté bien escrito (formato LOTE-AAAA-NNNN) o usa "Ver lotes" para ver los códigos existentes.`
      );
    }
    if (lote.estado !== EstadoLote.ALMACEN) {
      throw new BusinessError(
        400,
        `El lote ${codigo} está en estado ${lote.estado}; debe estar en ALMACEN para registrar una merma`
      );
    }

    const detalle = await tx.loteDetalle.findUnique({
      where: { loteId_talla: { loteId: lote.id, talla } },
    });
    if (!detalle) {
      throw new BusinessError(
        404,
        `El lote ${codigo} no tiene registrada la talla "${talla}". Usa "Detalle de un lote" para ver qué tallas tiene.`
      );
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
    await finalizarSiAlmacenVacio(tx, lote.id);

    const merma = await tx.merma.create({
      data: { loteDetalleId: detalle.id, cantidad, motivo },
    });

    return { ...merma, codigo, talla };
  });
}

import { EstadoLote } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { parseFechaOpcional, requireString } from '../lib/validators';

type DateRange = { gte?: Date; lte?: Date };

function buildDateRange(desde?: Date, hasta?: Date): DateRange | undefined {
  if (!desde && !hasta) return undefined;
  const range: DateRange = {};
  if (desde) range.gte = desde;
  if (hasta) range.lte = hasta;
  return range;
}

function parseRango(input: unknown) {
  const query = (input ?? {}) as Record<string, unknown>;
  const desde = parseFechaOpcional(query.desde, 'desde');
  const hasta = parseFechaOpcional(query.hasta, 'hasta');
  return { desde, hasta, query };
}

export async function reporteProduccion(input: unknown) {
  const { desde, hasta } = parseRango(input);
  const rango = buildDateRange(desde, hasta);

  const [lotesCreados, lotesFinalizados] = await Promise.all([
    prisma.lote.findMany({
      where: { fechaCreacion: rango },
      include: {
        producto: { select: { nombre: true } },
        detalles: { select: { cantidadInicial: true } },
      },
    }),
    prisma.lote.count({
      where: { estado: EstadoLote.FINALIZADO, fechaFinalizacion: rango },
    }),
  ]);

  const unidadesLote = (dets: { cantidadInicial: number }[]) =>
    dets.reduce((s, d) => s + d.cantidadInicial, 0);

  const porProducto = new Map<
    string,
    { producto: string; lotes: number; unidadesProducidas: number; metrosConsumidos: number }
  >();
  for (const l of lotesCreados) {
    const key = l.producto.nombre;
    const g = porProducto.get(key) ?? {
      producto: key,
      lotes: 0,
      unidadesProducidas: 0,
      metrosConsumidos: 0,
    };
    g.lotes += 1;
    g.unidadesProducidas += unidadesLote(l.detalles);
    g.metrosConsumidos += Number(l.metrosTelaUsados);
    porProducto.set(key, g);
  }

  return {
    rango: { desde: desde ?? null, hasta: hasta ?? null },
    lotesCreados: lotesCreados.length,
    lotesFinalizados,
    unidadesProducidas: lotesCreados.reduce((s, l) => s + unidadesLote(l.detalles), 0),
    metrosTelaConsumidos: lotesCreados.reduce((s, l) => s + Number(l.metrosTelaUsados), 0),
    porProducto: Array.from(porProducto.values()).sort(
      (a, b) => b.unidadesProducidas - a.unidadesProducidas
    ),
  };
}

export async function reporteMovimientos(input: unknown) {
  const { desde, hasta, query } = parseRango(input);
  const rango = buildDateRange(desde, hasta);
  const tienda = query.tienda === undefined ? undefined : requireString(query.tienda, 'tienda');
  const producto = query.producto === undefined ? undefined : requireString(query.producto, 'producto');

  const where = {
    fecha: rango,
    ...(tienda && { tienda: { nombre: tienda } }),
    ...(producto && { loteDetalle: { lote: { producto: { nombre: producto } } } }),
  };

  const [transferencias, ventas] = await Promise.all([
    prisma.transferencia.findMany({
      where,
      include: {
        tienda: { select: { nombre: true } },
        loteDetalle: { include: { lote: { include: { producto: { select: { nombre: true } } } } } },
      },
    }),
    prisma.venta.findMany({
      where,
      include: {
        tienda: { select: { nombre: true } },
        loteDetalle: { include: { lote: { include: { producto: { select: { nombre: true } } } } } },
      },
    }),
  ]);

  type Row = { tienda: { nombre: string }; cantidad: number; loteDetalle: { lote: { producto: { nombre: string } } } };
  const sumar = (rows: Row[], keyFn: (r: Row) => string) => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(keyFn(r), (map.get(keyFn(r)) ?? 0) + r.cantidad);
    return map;
  };

  const trTienda = sumar(transferencias, (r) => r.tienda.nombre);
  const vtTienda = sumar(ventas, (r) => r.tienda.nombre);
  const trProducto = sumar(transferencias, (r) => r.loteDetalle.lote.producto.nombre);
  const vtProducto = sumar(ventas, (r) => r.loteDetalle.lote.producto.nombre);

  const porTienda = Array.from(new Set([...trTienda.keys(), ...vtTienda.keys()]))
    .map((nombre) => ({
      tienda: nombre,
      transferenciasUnidades: trTienda.get(nombre) ?? 0,
      ventasUnidades: vtTienda.get(nombre) ?? 0,
    }))
    .sort((a, b) => b.transferenciasUnidades + b.ventasUnidades - (a.transferenciasUnidades + a.ventasUnidades));

  const porProducto = Array.from(new Set([...trProducto.keys(), ...vtProducto.keys()]))
    .map((nombre) => ({
      producto: nombre,
      transferenciasUnidades: trProducto.get(nombre) ?? 0,
      ventasUnidades: vtProducto.get(nombre) ?? 0,
    }))
    .sort((a, b) => b.transferenciasUnidades + b.ventasUnidades - (a.transferenciasUnidades + a.ventasUnidades));

  return {
    rango: { desde: desde ?? null, hasta: hasta ?? null },
    filtros: { tienda: tienda ?? null, producto: producto ?? null },
    transferencias: {
      cantidad: transferencias.length,
      unidades: transferencias.reduce((s, t) => s + t.cantidad, 0),
    },
    ventas: {
      cantidad: ventas.length,
      unidades: ventas.reduce((s, v) => s + v.cantidad, 0),
    },
    porTienda,
    porProducto,
  };
}

function stats(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    promedio: Math.round(sum / values.length),
    mediana: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export async function reporteCicloLotes(input: unknown) {
  const { desde, hasta } = parseRango(input);
  const rango = buildDateRange(desde, hasta);

  const lotes = await prisma.lote.findMany({
    where: { estado: EstadoLote.FINALIZADO, fechaFinalizacion: rango },
    include: { producto: { select: { nombre: true } } },
    orderBy: { fechaFinalizacion: 'desc' },
  });

  const min = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 60000);

  const analizados = lotes
    .filter((l) => l.fechaCostura && l.fechaAcabado && l.fechaAlmacen && l.fechaFinalizacion)
    .map((l) => ({
      codigo: l.codigo,
      producto: l.producto.nombre,
      tipo: l.tipo,
      fechaCreacion: l.fechaCreacion,
      fechaFinalizacion: l.fechaFinalizacion!,
      tiempoTotalMinutos: min(l.fechaCreacion, l.fechaFinalizacion!),
      porFase: {
        corteMinutos: min(l.fechaCreacion, l.fechaCostura!),
        costuraMinutos: min(l.fechaCostura!, l.fechaAcabado!),
        acabadoMinutos: min(l.fechaAcabado!, l.fechaAlmacen!),
        almacenMinutos: min(l.fechaAlmacen!, l.fechaFinalizacion!),
      },
    }));

  return {
    rango: { desde: desde ?? null, hasta: hasta ?? null },
    lotesAnalizados: analizados.length,
    lotesIncompletos: lotes.length - analizados.length,
    estadisticas: {
      totalMinutos: stats(analizados.map((a) => a.tiempoTotalMinutos)),
      corteMinutos: stats(analizados.map((a) => a.porFase.corteMinutos)),
      costuraMinutos: stats(analizados.map((a) => a.porFase.costuraMinutos)),
      acabadoMinutos: stats(analizados.map((a) => a.porFase.acabadoMinutos)),
      almacenMinutos: stats(analizados.map((a) => a.porFase.almacenMinutos)),
    },
    lotes: analizados,
  };
}

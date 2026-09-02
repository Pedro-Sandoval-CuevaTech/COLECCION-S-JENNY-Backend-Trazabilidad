import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BusinessError } from '../errors';
import { requireString } from '../lib/validators';

type Tx = Prisma.TransactionClient | typeof prisma;

// Estandar del backend para nombres de catalogo (producto, tienda): se guardan tal cual
// los escribio el usuario, y toda busqueda/comparacion se hace sin distinguir
// mayusculas/minusculas (Prisma `mode: 'insensitive'`, ver tambien tiendas.ts). Asi
// "Vestido Niña" y "vestido niña" matchean como el mismo producto sin perder la
// capitalizacion original para mostrarla despues.
export function normalizarNombreProducto(raw: unknown): string {
  return requireString(raw, 'nombre').trim();
}

export async function buscarProductoPorNombre(nombre: string, tx: Tx = prisma) {
  return tx.producto.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
}

export async function listarProductos() {
  return prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
}

export async function crearProducto(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const nombre = normalizarNombreProducto(body.nombre);
  const descripcion =
    typeof body.descripcion === 'string' && body.descripcion.trim() !== ''
      ? body.descripcion
      : null;

  const existente = await buscarProductoPorNombre(nombre);
  if (existente) {
    throw new BusinessError(409, `El producto "${nombre}" ya está registrado.`);
  }

  return prisma.producto.create({ data: { nombre, descripcion } });
}

export async function crearProductos(nombres: unknown[]) {
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const nombre of nombres.map(normalizarNombreProducto).filter(Boolean)) {
    const clave = nombre.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    unicos.push(nombre);
  }

  const resultados = [];
  for (const nombre of unicos) {
    const existente = await buscarProductoPorNombre(nombre);
    if (existente) {
      resultados.push({ nombre, creado: false, mensaje: `El producto "${nombre}" ya está registrado.` });
      continue;
    }
    const producto = await prisma.producto.create({ data: { nombre, descripcion: null } });
    resultados.push({ nombre, creado: true, producto });
  }
  return resultados;
}

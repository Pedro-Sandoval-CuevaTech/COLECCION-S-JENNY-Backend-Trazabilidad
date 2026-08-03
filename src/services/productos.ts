import { prisma } from '../lib/prisma';

export async function listarProductos() {
  return prisma.producto.findMany({ orderBy: { nombre: 'asc' } });
}

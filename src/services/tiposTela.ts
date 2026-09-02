import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { BusinessError } from '../errors';
import { requireString } from '../lib/validators';

type Tx = Prisma.TransactionClient | typeof prisma;

// Mismo estandar case-insensitive que Producto/Tienda: se guarda tal cual lo escribio
// el usuario, se busca/compara ignorando mayusculas/minusculas.
export function normalizarNombreTipoTela(raw: unknown): string {
  return requireString(raw, 'nombre').trim();
}

export async function buscarTipoTelaPorNombre(nombre: string, tx: Tx = prisma) {
  return tx.tipoTela.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } });
}

export async function listarTiposTela() {
  return prisma.tipoTela.findMany({ orderBy: { nombre: 'asc' } });
}

export async function crearTipoTela(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const nombre = normalizarNombreTipoTela(body.nombre);

  const existente = await buscarTipoTelaPorNombre(nombre);
  if (existente) {
    throw new BusinessError(409, `El tipo de tela "${nombre}" ya está registrado.`);
  }

  return prisma.tipoTela.create({ data: { nombre } });
}

export async function crearTiposTela(nombres: unknown[]) {
  const vistos = new Set<string>();
  const unicos: string[] = [];
  for (const nombre of nombres.map(normalizarNombreTipoTela).filter(Boolean)) {
    const clave = nombre.toLowerCase();
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    unicos.push(nombre);
  }

  const resultados = [];
  for (const nombre of unicos) {
    const existente = await buscarTipoTelaPorNombre(nombre);
    if (existente) {
      resultados.push({ nombre, creado: false, mensaje: `El tipo de tela "${nombre}" ya está registrado.` });
      continue;
    }
    const tipoTela = await prisma.tipoTela.create({ data: { nombre } });
    resultados.push({ nombre, creado: true, tipoTela });
  }
  return resultados;
}

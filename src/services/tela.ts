import { prisma } from '../lib/prisma';
import { requirePositiveNumber, requireString } from '../lib/validators';

export async function stockTela() {
  const result = await prisma.tela.aggregate({ _sum: { metrosDisponibles: true } });
  return { metrosDisponibles: result._sum.metrosDisponibles ?? 0 };
}

export async function ingresarTela(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const proveedor = requireString(body.proveedor, 'proveedor');
  const metros = requirePositiveNumber(body.metros, 'metros');

  return prisma.tela.create({
    data: {
      proveedor,
      metrosIngresados: metros,
      metrosDisponibles: metros,
    },
  });
}

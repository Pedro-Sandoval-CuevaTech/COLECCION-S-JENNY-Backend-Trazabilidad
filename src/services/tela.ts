import { Rol } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  requirePositiveNumber,
  requireString,
  requireUsuarioConRol,
} from '../lib/validators';

export async function ingresarTela(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  await requireUsuarioConRol(body.telefono, Rol.ALMACEN);
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

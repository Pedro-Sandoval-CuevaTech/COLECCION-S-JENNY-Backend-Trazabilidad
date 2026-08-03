import type { Prisma, Rol, Usuario } from '@prisma/client';
import { prisma } from './prisma';
import { BusinessError } from '../errors';

type Tx = Prisma.TransactionClient | typeof prisma;

export function requireString(value: unknown, campo: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BusinessError(400, `${campo} es requerido y debe ser un string no vacío`);
  }
  return value;
}

export function requirePositiveNumber(value: unknown, campo: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BusinessError(400, `${campo} debe ser un número positivo`);
  }
  return value;
}

export function requirePositiveInt(value: unknown, campo: string): number {
  const n = requirePositiveNumber(value, campo);
  if (!Number.isInteger(n)) {
    throw new BusinessError(400, `${campo} debe ser un entero positivo`);
  }
  return n;
}

export function parseFechaOpcional(value: unknown, campo: string): Date | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new BusinessError(400, `${campo} debe ser una fecha en formato ISO string`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new BusinessError(400, `${campo} inválida; use YYYY-MM-DD o ISO 8601 (ej: 2026-08-01)`);
  }
  return d;
}

export function requireTallasArray(value: unknown): Array<{ talla: string; cantidad: number }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BusinessError(400, 'tallas debe ser un arreglo no vacío');
  }
  const vistas = new Set<string>();
  return value.map((item, idx) => {
    if (!item || typeof item !== 'object') {
      throw new BusinessError(400, `tallas[${idx}] debe ser un objeto { talla, cantidad }`);
    }
    const obj = item as Record<string, unknown>;
    const talla = requireString(obj.talla, `tallas[${idx}].talla`);
    const cantidad = requirePositiveInt(obj.cantidad, `tallas[${idx}].cantidad`);
    if (vistas.has(talla)) {
      throw new BusinessError(400, `talla "${talla}" duplicada en el request`);
    }
    vistas.add(talla);
    return { talla, cantidad };
  });
}

export async function requireUsuarioConRol(
  telefono: unknown,
  rolEsperado: Rol,
  tx: Tx = prisma
): Promise<Usuario> {
  const tel = requireString(telefono, 'telefono');
  const usuario = await tx.usuario.findUnique({ where: { telefono: tel } });
  if (!usuario) {
    throw new BusinessError(404, `Usuario con teléfono ${tel} no existe`);
  }
  if (usuario.rol !== rolEsperado) {
    throw new BusinessError(
      403,
      `Rol ${usuario.rol} no autorizado para esta acción; requiere ${rolEsperado}`
    );
  }
  return usuario;
}

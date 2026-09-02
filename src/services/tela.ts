import { prisma } from '../lib/prisma';
import { BusinessError } from '../errors';
import { requirePositiveNumber, requireString } from '../lib/validators';
import { buscarTipoTelaPorNombre } from './tiposTela';

export async function stockTela(tipoNombre?: string) {
  if (tipoNombre) {
    const tipo = await buscarTipoTelaPorNombre(tipoNombre);
    if (!tipo) {
      throw new BusinessError(
        404,
        `El tipo de tela "${tipoNombre}" no está registrado. Usa "Ver tipos de tela" para ver los disponibles.`
      );
    }
    const result = await prisma.tela.aggregate({
      where: { tipoTelaId: tipo.id },
      _sum: { metrosDisponibles: true },
    });
    return { tipoTela: tipo.nombre, metrosDisponibles: result._sum.metrosDisponibles ?? 0 };
  }

  const grupos = await prisma.tela.groupBy({
    by: ['tipoTelaId'],
    _sum: { metrosDisponibles: true },
  });
  const tipos = await prisma.tipoTela.findMany({
    where: { id: { in: grupos.map((g) => g.tipoTelaId) } },
  });
  const nombrePorId = new Map(tipos.map((t) => [t.id, t.nombre]));

  return grupos
    .map((g) => ({
      tipoTela: nombrePorId.get(g.tipoTelaId) ?? 'Desconocido',
      metrosDisponibles: g._sum.metrosDisponibles ?? 0,
    }))
    .sort((a, b) => a.tipoTela.localeCompare(b.tipoTela));
}

export async function ingresarTela(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const proveedor = requireString(body.proveedor, 'proveedor');
  const metros = requirePositiveNumber(body.metros, 'metros');
  const nombreTipo = requireString(body.tipoTela, 'tipoTela');

  const tipoTela = await buscarTipoTelaPorNombre(nombreTipo);
  if (!tipoTela) {
    throw new BusinessError(
      404,
      `El tipo de tela "${nombreTipo}" no está registrado. Antes de ingresar tela, el tipo debe existir en el catálogo — usa "Crear tipo de tela" primero.`
    );
  }

  return prisma.tela.create({
    data: {
      tipoTelaId: tipoTela.id,
      proveedor,
      metrosIngresados: metros,
      metrosDisponibles: metros,
    },
    include: { tipoTela: true },
  });
}

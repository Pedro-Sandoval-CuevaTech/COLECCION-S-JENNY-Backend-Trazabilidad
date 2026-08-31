import { prisma } from '../lib/prisma';
import { requireString } from '../lib/validators';
import { BusinessError } from '../errors';

export async function crearTelefonoAutorizado(input: unknown) {
  const body = (input ?? {}) as Record<string, unknown>;
  const phone = requireString(body.phone, 'phone');

  const existente = await prisma.authorizedPhone.findUnique({ where: { phone } });
  if (existente) {
    throw new BusinessError(409, `El teléfono ${phone} ya está autorizado`);
  }

  const digits = phone.replace(/\D/g, '');
  const codeVerification = digits.slice(-6).padStart(6, '0');
  return prisma.authorizedPhone.create({ data: { phone, codeVerification } });
}

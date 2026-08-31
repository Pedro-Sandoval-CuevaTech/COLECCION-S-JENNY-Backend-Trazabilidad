import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { BusinessError } from '../errors';

const INTERVAL_MINUTES = Number(process.env.CODE_VERIFICATION_INTERVAL_MINUTES ?? 40);

export const accessControl: RequestHandler = async (req, _res, next) => {
  const phone = req.header('x-phone');
  if (!phone) throw new BusinessError(401, 'Header x-phone es requerido');

  const record = await prisma.authorizedPhone.findUnique({ where: { phone } });
  if (!record) throw new BusinessError(401, 'Teléfono no autorizado');

  const vigente =
    record.lastCodeVerificationAt !== null &&
    Date.now() - record.lastCodeVerificationAt.getTime() < INTERVAL_MINUTES * 60_000;

  if (vigente) {
    next();
    return;
  }

  const code = req.header('x-code-verification');
  if (!code || code !== record.codeVerification) {
    throw new BusinessError(401, 'Código de verificación requerido o inválido');
  }

  await prisma.authorizedPhone.update({
    where: { phone },
    data: { lastCodeVerificationAt: new Date() },
  });
  next();
};

import type { ErrorRequestHandler } from 'express';
import { BusinessError } from '../errors';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof BusinessError) {
    res.status(err.status).json({ error: true, mensaje: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: true, mensaje: 'Error interno del servidor' });
};

import { Router } from 'express';
import { crearTelefonoAutorizado } from '../services/authorizedPhones';

const router = Router();

router.post('/', async (req, res) => {
  const data = await crearTelefonoAutorizado(req.body);
  const message = `Teléfono ${data.phone} autorizado. Código de verificación: ${data.codeVerification}`;
  res.status(201).json({ error: false, message, data });
});

export default router;

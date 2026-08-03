import { Router } from 'express';
import { ingresarTela } from '../services/tela';

const router = Router();

router.post('/ingresos', async (req, res) => {
  const data = await ingresarTela(req.body);
  res.status(201).json({ error: false, data });
});

export default router;

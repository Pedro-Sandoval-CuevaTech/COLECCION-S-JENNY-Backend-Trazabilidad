import { Router } from 'express';
import { ingresarTela, stockTela } from '../services/tela';

const router = Router();

router.get('/stock', async (_req, res) => {
  const data = await stockTela();
  const message = `Hay ${data.metrosDisponibles} metros de tela disponibles.`;
  res.json({ error: false, message, data });
});

router.post('/ingresos', async (req, res) => {
  const data = await ingresarTela(req.body);
  const message = `Se ingresaron ${data.metrosIngresados} metros de tela del proveedor "${data.proveedor}". Disponibles: ${data.metrosDisponibles} metros.`;
  res.status(201).json({ error: false, message, data });
});

export default router;

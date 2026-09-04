import { Router } from 'express';
import { ingresarTela, stockTela } from '../services/tela';

const router = Router();

router.get('/stock', async (req, res) => {
  const tipo = typeof req.query.tipo === 'string' ? req.query.tipo : undefined;
  const data = await stockTela(tipo);

  const message = Array.isArray(data)
    ? data.length === 0
      ? 'No hay tela registrada.'
      : `Tela disponible:\n${data.map((d) => `- ${d.tipoTela} (${d.metrosDisponibles}m)`).join('\n')}`
    : `Tela "${data.tipoTela}" disponible: ${data.metrosDisponibles} metros.`;

  res.json({ error: false, message, data });
});

router.post('/ingresos', async (req, res) => {
  const data = await ingresarTela(req.body);
  const message = `Se ingresaron ${data.metrosIngresados} metros de tela "${data.tipoTela.nombre}" del proveedor "${data.proveedor}". Disponibles de este tipo: ${data.metrosDisponibles} metros.`;
  res.status(201).json({ error: false, message, data });
});

export default router;

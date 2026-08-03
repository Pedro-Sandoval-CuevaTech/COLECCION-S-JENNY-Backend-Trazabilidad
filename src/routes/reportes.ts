import { Router } from 'express';
import {
  reporteCicloLotes,
  reporteMovimientos,
  reporteProduccion,
} from '../services/reportes';

const router = Router();

router.get('/produccion', async (req, res) => {
  const data = await reporteProduccion(req.query);
  res.json({ error: false, data });
});

router.get('/movimientos', async (req, res) => {
  const data = await reporteMovimientos(req.query);
  res.json({ error: false, data });
});

router.get('/ciclo-lotes', async (req, res) => {
  const data = await reporteCicloLotes(req.query);
  res.json({ error: false, data });
});

export default router;

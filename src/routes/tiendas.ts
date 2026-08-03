import { Router } from 'express';
import { listarTiendas, obtenerStockDeTiendas } from '../services/tiendas';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await listarTiendas();
  res.json({ error: false, data });
});

router.get('/stock', async (_req, res) => {
  const data = await obtenerStockDeTiendas();
  res.json({ error: false, data });
});

export default router;

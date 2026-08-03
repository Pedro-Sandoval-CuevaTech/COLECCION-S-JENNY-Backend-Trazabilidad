import { Router } from 'express';
import { listarProductos } from '../services/productos';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await listarProductos();
  res.json({ error: false, data });
});

export default router;

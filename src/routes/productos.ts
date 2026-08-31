import { Router } from 'express';
import { listarProductos } from '../services/productos';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await listarProductos();
  const message =
    data.length === 0
      ? 'No hay productos registrados.'
      : `Hay ${data.length} producto${data.length > 1 ? 's' : ''}: ${data.map((p) => p.nombre).join(', ')}.`;
  res.json({ error: false, message, data });
});

export default router;

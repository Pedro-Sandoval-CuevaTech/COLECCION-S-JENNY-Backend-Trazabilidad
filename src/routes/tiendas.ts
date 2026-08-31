import { Router } from 'express';
import { listarTiendas, obtenerStockDeTiendas } from '../services/tiendas';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await listarTiendas();
  const message =
    data.length === 0
      ? 'No hay tiendas registradas.'
      : `Hay ${data.length} tienda${data.length > 1 ? 's' : ''} registrada${data.length > 1 ? 's' : ''}: ${data.map((t) => t.nombre).join(', ')}.`;
  res.json({ error: false, message, data });
});

router.get('/stock', async (_req, res) => {
  const data = await obtenerStockDeTiendas();
  const total = data.reduce((s, t) => s + t.totalUnidades, 0);
  const resumen = data.map((t) => `${t.tienda} (${t.totalUnidades} uds.)`).join(', ');
  const message =
    total === 0
      ? 'No hay stock disponible en ninguna tienda.'
      : `Stock total: ${total} unidades distribuidas en ${data.length} tienda${data.length > 1 ? 's' : ''}: ${resumen}.`;
  res.json({ error: false, message, data });
});

export default router;

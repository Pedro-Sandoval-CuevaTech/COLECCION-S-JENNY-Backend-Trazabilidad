import { Router } from 'express';
import {
  avanzarLote,
  crearLote,
  finalizarLote,
  listarLotes,
  obtenerLote,
  transferirLote,
  venderLote,
} from '../services/lotes';

const router = Router();

router.post('/', async (req, res) => {
  const data = await crearLote(req.body);
  res.status(201).json({ error: false, data });
});

router.get('/', async (req, res) => {
  const data = await listarLotes(req.query);
  res.json({ error: false, data });
});

router.get('/:codigo', async (req, res) => {
  const data = await obtenerLote(req.params.codigo);
  res.json({ error: false, data });
});

router.post('/:codigo/avance', async (req, res) => {
  const data = await avanzarLote(req.params.codigo, req.body);
  res.json({ error: false, data });
});

router.post('/:codigo/transferencias', async (req, res) => {
  const data = await transferirLote(req.params.codigo, req.body);
  res.status(201).json({ error: false, data });
});

router.post('/:codigo/ventas', async (req, res) => {
  const data = await venderLote(req.params.codigo, req.body);
  res.status(201).json({ error: false, data });
});

router.post('/:codigo/finalizar', async (req, res) => {
  const data = await finalizarLote(req.params.codigo, req.body);
  res.json({ error: false, data });
});

export default router;

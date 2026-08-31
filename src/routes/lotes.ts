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
  const tallas = data.detalles.map((d: any) => `${d.talla}(${d.cantidadInicial})`).join(', ');
  const message = `Lote ${data.codigo} creado para "${data.producto.nombre}". Tallas: ${tallas}. Estado inicial: CORTE.`;
  res.status(201).json({ error: false, message, data });
});

router.get('/', async (req, res) => {
  const data = await listarLotes(req.query);
  if (data.length === 0) {
    res.json({ error: false, message: 'No se encontraron lotes con esos filtros.', data });
    return;
  }
  const vista = data.slice(0, 5).map((l: any) => `${l.codigo} (${l.producto} — ${l.estado})`).join('; ');
  const sufijo = data.length > 5 ? `... y ${data.length - 5} más.` : '.';
  const message = `Hay ${data.length} lote${data.length > 1 ? 's' : ''}: ${vista}${sufijo}`;
  res.json({ error: false, message, data });
});

router.get('/:codigo', async (req, res) => {
  const data = await obtenerLote(req.params.codigo);
  const tallas = data.detalleTallas
    .map((d: any) => `${d.talla}: ${d.stockAlmacen} en almacén`)
    .join(', ');
  const message = `Lote ${data.codigo} — ${data.producto} | Estado: ${data.estado} | Tipo: ${data.tipo} | Tallas: ${tallas}.`;
  res.json({ error: false, message, data });
});

router.post('/:codigo/avance', async (req, res) => {
  const data = await avanzarLote(req.params.codigo, req.body);
  const message = `El lote ${data.codigo} avanzó correctamente al estado ${data.estado}.`;
  res.json({ error: false, message, data });
});

router.post('/:codigo/transferencias', async (req, res) => {
  const data = await transferirLote(req.params.codigo, req.body);
  const { talla, tienda, cantidad } = req.body;
  const message = `Se transfirieron ${cantidad} unidades de talla ${talla} del lote ${req.params.codigo} a la tienda "${tienda}".`;
  res.status(201).json({ error: false, message, data });
});

router.post('/:codigo/ventas', async (req, res) => {
  const data = await venderLote(req.params.codigo, req.body);
  const { talla } = req.body;
  const message = `Venta registrada: ${data.cantidad} unidades de talla ${talla} del lote ${req.params.codigo}.`;
  res.status(201).json({ error: false, message, data });
});

router.post('/:codigo/finalizar', async (req, res) => {
  const data = await finalizarLote(req.params.codigo, req.body);
  const message = `El lote ${data.codigo} fue finalizado exitosamente.`;
  res.json({ error: false, message, data });
});

export default router;

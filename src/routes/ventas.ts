import { Router } from 'express';
import { venderProducto } from '../services/ventas';

const router = Router();

router.post('/', async (req, res) => {
  const data = await venderProducto(req.body);
  const message = `Venta registrada: ${data.cantidad} unidades de "${data.producto.nombre}" talla ${data.talla} en la tienda "${data.tienda.nombre}".`;
  res.status(201).json({ error: false, message, data });
});

export default router;

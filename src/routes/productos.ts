import { Router } from 'express';
import { crearProducto, crearProductos, listarProductos } from '../services/productos';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await listarProductos();
  const message =
    data.length === 0
      ? 'No hay productos registrados.'
      : `Hay ${data.length} producto${data.length > 1 ? 's' : ''}:\n${data.map((p) => `- ${p.nombre}`).join('\n')}`;
  res.json({ error: false, message, data });
});

router.post('/', async (req, res) => {
  const nombre = req.body?.nombre;
  const nombres = Array.isArray(nombre)
    ? nombre
    : typeof nombre === 'string' && nombre.includes(',')
      ? nombre.split(',')
      : null;

  if (nombres) {
    const resultados = await crearProductos(nombres);
    const creados = resultados.filter((r) => r.creado).length;
    const detalle = resultados
      .map((r) => (r.creado ? r.nombre : `${r.nombre} (ya existía)`))
      .join(', ');
    const message = `Se crearon ${creados} de ${resultados.length} productos: ${detalle}.`;
    res.status(201).json({ error: false, message, data: resultados });
    return;
  }

  const data = await crearProducto(req.body);
  const message = `Producto "${data.nombre}" registrado en el catálogo.`;
  res.status(201).json({ error: false, message, data });
});

export default router;

import { Router } from 'express';
import { crearTipoTela, crearTiposTela, listarTiposTela } from '../services/tiposTela';

const router = Router();

router.get('/', async (_req, res) => {
  const data = await listarTiposTela();
  const message =
    data.length === 0
      ? 'No hay tipos de tela registrados.'
      : `Hay ${data.length} tipo${data.length > 1 ? 's' : ''} de tela:\n${data.map((t) => `- ${t.nombre}`).join('\n')}`;
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
    const resultados = await crearTiposTela(nombres);
    const creados = resultados.filter((r) => r.creado).length;
    const detalle = resultados
      .map((r) => (r.creado ? r.nombre : `${r.nombre} (ya existía)`))
      .join(', ');
    const message = `Se crearon ${creados} de ${resultados.length} tipos de tela: ${detalle}.`;
    res.status(201).json({ error: false, message, data: resultados });
    return;
  }

  const data = await crearTipoTela(req.body);
  const message = `Tipo de tela "${data.nombre}" registrado en el catálogo.`;
  res.status(201).json({ error: false, message, data });
});

export default router;

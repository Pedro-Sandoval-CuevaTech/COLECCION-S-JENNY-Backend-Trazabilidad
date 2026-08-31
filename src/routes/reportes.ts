import { Router } from 'express';
import {
  reporteCicloLotes,
  reporteMovimientos,
  reporteProduccion,
} from '../services/reportes';

const router = Router();

router.get('/produccion', async (req, res) => {
  const data = await reporteProduccion(req.query);
  const top = data.porProducto[0];
  const topTexto = top ? ` El más producido: "${top.producto}" con ${top.unidadesProducidas} unidades.` : '';
  const message = `Producción: ${data.lotesCreados} lotes creados, ${data.lotesFinalizados} finalizados, ${data.unidadesProducidas} unidades producidas y ${Number(data.metrosTelaConsumidos).toFixed(2)} metros de tela consumidos.${topTexto}`;
  res.json({ error: false, message, data });
});

router.get('/movimientos', async (req, res) => {
  const data = await reporteMovimientos(req.query);
  const message = `Movimientos: ${data.transferencias.cantidad} transferencia${data.transferencias.cantidad !== 1 ? 's' : ''} (${data.transferencias.unidades} uds.) y ${data.ventas.cantidad} venta${data.ventas.cantidad !== 1 ? 's' : ''} (${data.ventas.unidades} uds.).`;
  res.json({ error: false, message, data });
});

router.get('/ciclo-lotes', async (req, res) => {
  const data = await reporteCicloLotes(req.query);
  const promedio = data.estadisticas.totalMinutos?.promedio;
  const promedioTexto = promedio != null ? ` Tiempo promedio total: ${promedio} minutos.` : '';
  const incompletos = data.lotesIncompletos > 0 ? `, ${data.lotesIncompletos} sin datos completos` : '';
  const message = `Ciclo de lotes: ${data.lotesAnalizados} lote${data.lotesAnalizados !== 1 ? 's' : ''} analizado${data.lotesAnalizados !== 1 ? 's' : ''}${incompletos}.${promedioTexto}`;
  res.json({ error: false, message, data });
});

export default router;

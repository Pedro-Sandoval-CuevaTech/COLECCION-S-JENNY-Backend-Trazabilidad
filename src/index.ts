import express from 'express';
import swaggerUi from 'swagger-ui-express';
import tiendasRouter from './routes/tiendas';
import telaRouter from './routes/tela';
import lotesRouter from './routes/lotes';
import productosRouter from './routes/productos';
import reportesRouter from './routes/reportes';
import authorizedPhonesRouter from './routes/authorizedPhones';
import { errorHandler } from './middleware/errorHandler';
import { accessControl } from './middleware/accessControl';
import { openapiSpec } from './openapi';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ error: false, data: { status: 'ok' } });
});

app.get('/openapi.json', (_req, res) => res.json(openapiSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use('/api', accessControl);

app.use('/api/tiendas', tiendasRouter);
app.use('/api/productos', productosRouter);
app.use('/api/tela', telaRouter);
app.use('/api/lotes', lotesRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/authorized-phones', authorizedPhonesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: true, mensaje: 'Ruta no encontrada' });
});

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});

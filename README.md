# Backend Trazabilidad Textil — COLECCION'S JENNY

MVP para tesis de Ingeniería de Sistemas. Reemplaza el registro manual de la producción textil por el flujo:

**WhatsApp → n8n → IA (extrae intención) → esta API REST → PostgreSQL**

La API recibe eventos como *"corté un lote de vestidos"*, *"transferí 5 T2 a Tienda Centro"* o *"vendí 2 T2"*, y lleva el inventario y la trazabilidad de cada lote desde el corte hasta la venta final.

## Stack

- Node.js 20+ / TypeScript / Express 5
- PostgreSQL 16 (en Docker)
- Prisma ORM
- Sin autenticación JWT: la identidad es el campo `telefono` resuelto contra la tabla `Usuario`

## Cómo levantarlo

Requisitos: Docker Desktop + Node 20+.

```bash
cd backend
cp .env.example .env
npm install
docker compose up -d --wait          # postgres en :5433
npx prisma migrate dev --name init   # crea tablas
npm run seed                          # data de prueba
npm run dev                           # API en :3000
```

Verifica:
```bash
curl http://localhost:3000/health
# → {"error":false,"data":{"status":"ok"}}
```

## Cómo funciona (un lote de principio a fin)

### 1. ALMACÉN ingresa 200m de tela
```http
POST /api/tela/ingresos
```
```json
{ "telefono": "TEST-ALMACEN-001", "proveedor": "Textiles ABC", "metros": 200 }
```

### 2. CORTADOR crea el lote (Vestido Escolar, 3 tallas)
```http
POST /api/lotes
```
```json
{
  "telefono": "TEST-CORTADOR-001",
  "producto": "Vestido Escolar",
  "metrosTela": 80,
  "tallas": [
    { "talla": "T1", "cantidad": 10 },
    { "talla": "T2", "cantidad": 15 },
    { "talla": "T3", "cantidad": 20 }
  ]
}
```
Se descuentan 80m de tela (FIFO), se crea `LOTE-2026-0001` en estado **CORTE**.

### 3. El lote avanza de fase (una llamada por rol)
```
CORTADOR → COSTURA:  POST /api/lotes/LOTE-2026-0001/avance  con telefono del cortador
COSTURA  → ACABADO:  POST /api/lotes/LOTE-2026-0001/avance  con telefono de costura
ACABADO  → ALMACEN:  POST /api/lotes/LOTE-2026-0001/avance  con telefono de acabado
```
Al entrar a ALMACÉN se inicializa el stock por talla (T1=10, T2=15, T3=20).

### 4. ALMACÉN transfiere 5 unidades de T2 a Tienda Centro
```http
POST /api/lotes/LOTE-2026-0001/transferencias
```
```json
{ "telefono": "TEST-ALMACEN-001", "tienda": "Tienda Centro", "talla": "T2", "cantidad": 5 }
```

### 5. VENDEDOR vende 2 T2 (la tienda se resuelve por su usuario)
```http
POST /api/lotes/LOTE-2026-0001/ventas
```
```json
{ "telefono": "TEST-VENDEDOR-001", "talla": "T2", "cantidad": 2 }
```

### 6. Consulta la historia completa
```http
GET /api/lotes/LOTE-2026-0001
```
Devuelve el lote con estado, producto, tallas, stocks en almacén, stocks en cada tienda, transferencias y ventas — todo agrupado por talla.

---

## Endpoints

Todas las respuestas siguen el formato:
- Éxito: `{ "error": false, "data": { ... } }`
- Error: `{ "error": true, "mensaje": "..." }`

### Setup y catálogo (sin rol)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Verifica que la API está viva |
| `GET` | `/api/tiendas` | Lista las tiendas |
| `GET` | `/api/productos` | Lista los productos que fabrica la empresa |
| `GET` | `/api/tiendas/stock` | Inventario actual de todas las tiendas (agrupado por lote → talla) |

### Producción

| Método | Ruta | Rol requerido | Qué hace |
|---|---|---|---|
| `POST` | `/api/tela/ingresos` | ALMACEN | Registra un ingreso de metros de tela |
| `POST` | `/api/lotes` | CORTADOR | Crea un lote multi-talla; consume tela FIFO; estado inicial CORTE |
| `POST` | `/api/lotes/:codigo/avance` | según fase | Avanza el estado (CORTE→COSTURA→ACABADO→ALMACEN) |
| `POST` | `/api/lotes/:codigo/transferencias` | ALMACEN | Mueve unidades de una talla a una tienda |
| `POST` | `/api/lotes/:codigo/ventas` | VENDEDOR | Registra una venta (tienda = la del vendedor) |
| `POST` | `/api/lotes/:codigo/finalizar` | ALMACEN | Finalización manual (solo lotes tipo PEDIDO) |
| `GET` | `/api/lotes` | — | Lista lotes con filtros opcionales `?estado=&tipo=` |
| `GET` | `/api/lotes/:codigo` | — | **Trazabilidad completa del lote** (para sustentación) |

### Reportes

| Método | Ruta | Para qué |
|---|---|---|
| `GET` | `/api/reportes/produccion?desde=&hasta=` | Lotes creados/finalizados, unidades y tela consumida en el rango; desglose por producto |
| `GET` | `/api/reportes/movimientos?desde=&hasta=&tienda=&producto=` | Totales de transferencias y ventas; desglose por tienda y producto |
| `GET` | `/api/reportes/ciclo-lotes?desde=&hasta=` | Duración por fase de lotes finalizados (promedio, mediana, min, max en minutos) |

Los filtros de fecha usan ISO 8601 (`?desde=2026-01-01&hasta=2026-12-31`). Si se omiten, no hay filtro.

---

## Reglas de negocio importantes

- **Estados**: `CORTE → COSTURA → ACABADO → ALMACEN → FINALIZADO`
- **Cada rol avanza solo su transición**:
  - `CORTADOR` avanza `CORTE → COSTURA`
  - `COSTURA` avanza `COSTURA → ACABADO`
  - `ACABADO` avanza `ACABADO → ALMACEN`
  - `ALMACEN` no avanza — usa transferencias/ventas
- **Tipos de lote**:
  - `STOCK` (default): se **auto-finaliza** cuando `stockAlmacen + suma(stocks en tiendas) = 0`
  - `PEDIDO`: se finaliza manualmente con `/finalizar`
- **Tela**: consumo **FIFO**. Si no alcanza → 400 y no se crea nada (todo en transacción).
- **Vendedor**: su tienda está fija en `Usuario.tiendaId`. No puede vender desde otra.
- **Inventario por talla**: `LoteDetalle.stockAlmacen` guarda lo que hay en almacén; `LoteTienda.cantidad` guarda lo que hay en cada tienda. Ambos por talla.

## Modelo de datos

```
Producto ──┐
           │
           └── Lote ── LoteDetalle ──┬── LoteTienda ── Tienda
                       (una por      ├── Transferencia
                        talla)       └── Venta

Tela (inventario FIFO)      Usuario ── Tienda (solo VENDEDOR)
```

- **Lote**: código autogenerado `LOTE-YYYY-NNNN`, estado, tipo, timestamps por fase (`fechaCreacion`, `fechaCostura`, `fechaAcabado`, `fechaAlmacen`, `fechaFinalizacion`).
- **LoteDetalle**: una fila por talla dentro del lote. `@@unique([loteId, talla])`.
- **LoteTienda**: saldo actual por (talla, tienda). Se actualiza con upsert (no crea filas nuevas por movimiento).
- **Transferencia / Venta**: append-only, para trazabilidad y reportes.
- **Usuario**: PK = `telefono`; rol y opcionalmente `tiendaId`.

## Usuarios de prueba (del seed)

| Teléfono | Rol | Tienda |
|---|---|---|
| `TEST-CORTADOR-001` | CORTADOR | — |
| `TEST-COSTURA-001` | COSTURA | — |
| `TEST-ACABADO-001` | ACABADO | — |
| `TEST-ALMACEN-001` | ALMACEN | — |
| `TEST-VENDEDOR-001` | VENDEDOR | Tienda Centro |

**Productos**: Vestido Escolar, Polo Escolar, Blusa Ejecutiva.
**Tiendas**: Tienda Centro, Tienda Norte, Tienda Sur.

## Variables de entorno (`.env`)

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/trazabilidad?schema=public"
PORT=3000
```

> Postgres corre en el puerto **5433** (no 5432) para no chocar con otras instancias locales.

## Probar con Postman

Importa `postman_collection.json`: 17 requests en 5 carpetas (Setup, Catálogo, Tela, Lotes, Reportes) con todos los ejemplos precargados. Las variables `{{baseUrl}}`, `{{codigo}}` y los `{{telefonoXxx}}` ya vienen configuradas.

## Scripts útiles

| Comando | Qué hace |
|---|---|
| `npm run dev` | API en modo watch |
| `npm run seed` | Puebla la DB con data de prueba |
| `npm run build` | Compila TS → JS en `dist/` |
| `npm start` | Corre la versión compilada |
| `npm run prisma:migrate` | Aplica migraciones pendientes |
| `npx prisma studio` | UI web para inspeccionar/editar la DB (útil para reasignar `tiendaId` de un vendedor) |

## Resetear la DB desde cero

```bash
docker compose down -v          # borra el volumen de postgres
docker compose up -d --wait
rm -rf prisma/migrations         # opcional: empieza con migración limpia
npx prisma migrate dev --name init
npm run seed
```

## Estructura del proyecto

```
backend/
├── prisma/
│   ├── schema.prisma        # modelo de datos
│   ├── migrations/          # historia de migraciones
│   └── seed.ts              # data de prueba (tiendas, productos, usuarios)
├── src/
│   ├── index.ts             # entry point (Express + rutas + error handler)
│   ├── errors.ts            # BusinessError
│   ├── lib/
│   │   ├── prisma.ts        # cliente Prisma singleton
│   │   └── validators.ts    # helpers de validación
│   ├── middleware/
│   │   └── errorHandler.ts  # captura BusinessError y errores 500
│   ├── routes/              # rutas Express (dumb, solo delegan a services)
│   │   ├── tiendas.ts
│   │   ├── productos.ts
│   │   ├── tela.ts
│   │   ├── lotes.ts
│   │   └── reportes.ts
│   └── services/            # lógica de negocio + acceso a Prisma
│       ├── tiendas.ts
│       ├── productos.ts
│       ├── tela.ts
│       ├── lotes.ts
│       └── reportes.ts
├── docker-compose.yml        # postgres:16-alpine en :5433
├── postman_collection.json   # colección para importar en Postman
├── .env.example
└── package.json
```

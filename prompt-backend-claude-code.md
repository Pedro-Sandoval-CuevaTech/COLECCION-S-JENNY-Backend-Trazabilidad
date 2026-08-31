# Prompt para Claude Code — Backend MVP de trazabilidad (COLECCION'S JENNY)

Cópialo tal cual en Claude Code como instrucción inicial del proyecto.

---

## Contexto

Estoy construyendo el backend de un **MVP** para una tesis de Ingeniería de Sistemas ("Efecto de la orquestación de flujos de trabajo en la integridad de la trazabilidad de la producción industrial"). El objetivo del MVP es demostrar que un flujo **WhatsApp → n8n → IA (extracción de intención) → Backend REST → PostgreSQL** puede reemplazar el registro manual de la producción textil y mejorar la trazabilidad de lotes.

**Este NO es un ERP textil ni un sistema empresarial.** Aplica el principio KISS de forma estricta: no agregues autenticación compleja, no agregues roles administrativos, no agregues funcionalidades no descritas abajo, no sobre-diseñes capas de abstracción innecesarias. Si en algún punto ves una forma más simple de lograr lo mismo, prefiérela y dime por qué.

Toda la lógica de negocio (validaciones, transiciones de estado, cálculos de stock) vive en este backend. El backend no sabe nada de WhatsApp ni de IA — solo expone una API REST que n8n consumirá.

## Stack obligatorio

- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- Docker + docker-compose (app + postgres)
- Sin frontend. Sin autenticación JWT/OAuth — la única "identidad" del sistema es el campo `telefono` que llega en cada request, que se resuelve contra la tabla `Usuario`.

## Modelo de datos (Prisma schema)

Implementa exactamente estas entidades, sin campos adicionales:

```prisma
model Tela {
  id                 Int      @id @default(autoincrement())
  proveedor          String
  metrosIngresados   Decimal
  metrosDisponibles  Decimal
  fechaIngreso       DateTime @default(now())
}

enum EstadoLote {
  COSTURA
  ACABADO
  ALMACEN
  FINALIZADO
}

enum TipoLote {
  STOCK
  PEDIDO
}

model Lote {
  id                 Int         @id @default(autoincrement())
  codigo             String      @unique
  modelo             String
  metrosTelaUsados   Decimal
  unidadesTotales    Int
  estado             EstadoLote  @default(COSTURA)
  tipo               TipoLote    @default(STOCK)
  stockAlmacen       Int         @default(0)
  fechaCreacion      DateTime    @default(now())
  fechaFinalizacion  DateTime?
  loteTiendas        LoteTienda[]
  transferencias     Transferencia[]
  ventas             Venta[]
}

model Tienda {
  id              Int              @id @default(autoincrement())
  nombre          String           @unique
  loteTiendas     LoteTienda[]
  transferencias  Transferencia[]
  ventas          Venta[]
  usuarios        Usuario[]
}

model LoteTienda {
  loteId    Int
  tiendaId  Int
  cantidad  Int      @default(0)
  lote      Lote     @relation(fields: [loteId], references: [id])
  tienda    Tienda   @relation(fields: [tiendaId], references: [id])
  @@id([loteId, tiendaId])
}

enum Rol {
  CORTADOR
  COSTURA
  ACABADO
  ALMACEN
  VENDEDOR
}

model Usuario {
  telefono  String   @id
  rol       Rol
  tiendaId  Int?
  tienda    Tienda?  @relation(fields: [tiendaId], references: [id])
}

model Transferencia {
  id        Int      @id @default(autoincrement())
  loteId    Int
  tiendaId  Int
  cantidad  Int
  fecha     DateTime @default(now())
  lote      Lote     @relation(fields: [loteId], references: [id])
  tienda    Tienda   @relation(fields: [tiendaId], references: [id])
}

model Venta {
  id        Int      @id @default(autoincrement())
  loteId    Int
  tiendaId  Int
  cantidad  Int
  fecha     DateTime @default(now())
  lote      Lote     @relation(fields: [loteId], references: [id])
  tienda    Tienda   @relation(fields: [tiendaId], references: [id])
}
```

## Endpoints REST a implementar

Todos reciben y devuelven JSON. Todas las respuestas de error deben tener el formato:
```json
{ "error": true, "mensaje": "texto explicando qué falló" }
```
Todas las respuestas de éxito:
```json
{ "error": false, "data": { ... } }
```

### 1. `POST /api/tela/ingresos`
Body: `{ telefono, proveedor, metros }`
- Valida que `telefono` exista en `Usuario` con `rol = ALMACEN`.
- Crea un registro `Tela` con `metrosIngresados = metrosDisponibles = metros`.

### 2. `POST /api/lotes`
Body: `{ telefono, modelo, metrosTela, unidades }`
- Valida `rol = CORTADOR`.
- Verifica que exista suficiente `metrosDisponibles` sumando entre los registros de `Tela` (para el MVP, descuenta del/los registros de tela más antiguos hasta cubrir el monto — FIFO simple solo para el insumo tela, no para lotes).
- Crea el `Lote` con `estado = COSTURA`, `unidadesTotales = unidades`, código autogenerado con formato `LOTE-{YYYY}-{secuencial 4 dígitos}`.

### 3. `POST /api/lotes/:codigo/avance`
Body: `{ telefono }`
- Resuelve el rol desde `Usuario`.
- Mapea rol → transición esperada: `COSTURA` puede avanzar un lote que está en `COSTURA` hacia `ACABADO`; `ACABADO` puede avanzar un lote en `ACABADO` hacia `ALMACEN`; `ALMACEN` puede avanzar un lote en `ALMACEN`... en este último caso no hay siguiente estado de producción, así que ese rol usa los endpoints de transferencia/venta en vez de avance.
- Si el rol no corresponde al estado actual del lote, responde error explicando el estado real y el rol recibido.
- Si el nuevo estado es `ALMACEN`, inicializa `stockAlmacen = unidadesTotales`.

### 4. `POST /api/lotes/:codigo/transferencias`
Body: `{ telefono, tienda, cantidad }`
- Valida `rol = ALMACEN`.
- Valida que `tienda` exista en el catálogo `Tienda` (por nombre).
- Valida que el lote esté en `estado = ALMACEN` y tenga `stockAlmacen >= cantidad`.
- Descuenta `stockAlmacen`, hace upsert en `LoteTienda` (crea si no existe, suma si ya existe), y crea el registro `Transferencia`.

### 5. `POST /api/lotes/:codigo/ventas`
Body: `{ telefono, cantidad }`
- Valida `rol = VENDEDOR` y que el `Usuario` tenga `tiendaId` asignado (la tienda de la venta es la del vendedor, no viene en el body).
- Valida que exista `LoteTienda` para ese lote+tienda con `cantidad >= cantidad solicitada`.
- Descuenta de `LoteTienda`, crea el registro `Venta`.
- Después de descontar, recalcula: si `stockAlmacen + suma de todas las cantidades en LoteTienda del lote = 0`, marca el lote como `FINALIZADO` y guarda `fechaFinalizacion`.

### 6. `POST /api/lotes/:codigo/finalizar`
Body: `{ telefono }`
- Valida `rol = ALMACEN`.
- Solo permitido si `lote.tipo = PEDIDO` y el lote no está ya `FINALIZADO`.
- Marca `estado = FINALIZADO`, `fechaFinalizacion = now()`.

### 7. `GET /api/lotes/:codigo`
- Devuelve el lote completo con su historial: datos del lote, `LoteTienda` actuales, `Transferencia[]`, `Venta[]`. Este endpoint es para poder demostrar la trazabilidad end-to-end en la sustentación de tesis — cuídalo especialmente.

### 8. `GET /api/tiendas`
- Lista el catálogo de tiendas.

## Seed de datos

Crea un script de seed (`prisma/seed.ts`) que inserte:
- 2-3 tiendas de ejemplo.
- Un usuario por cada rol (`CORTADOR`, `COSTURA`, `ACABADO`, `ALMACEN`, y un `VENDEDOR` con `tiendaId` asignado), con números de teléfono ficticios claramente marcados como de prueba.

## Cómo quiero que trabajes

Procede en fases, y al terminar cada una muéstrame un resumen breve de qué hiciste antes de seguir con la siguiente:

1. Scaffolding del proyecto (package.json, tsconfig, estructura de carpetas, Express básico con un healthcheck).
2. Prisma: schema.prisma con el modelo de arriba, migración inicial, cliente generado.
3. Seed de datos.
4. Implementación de los 8 endpoints, uno por uno, con sus validaciones. Usa una capa de servicios separada de las rutas (routes → services → prisma), pero sin sobrepasar eso en capas.
5. Manejo de errores centralizado (middleware) que capture excepciones de negocio y devuelva el formato de error acordado.
6. Dockerfile + docker-compose.yml (app + postgres) que levante todo con `docker compose up`.
7. Un README corto con: cómo levantar el proyecto, variables de entorno necesarias, y la lista de endpoints con ejemplos de request/response.

No implementes tests automatizados a menos que yo te lo pida después — no es indispensable para este MVP y prefiero priorizar tiempo en el flujo completo funcionando.

Antes de escribir código, confírmame que entendiste el alcance y dime si ves algún punto ambiguo o inconsistente en este modelo antes de empezar.

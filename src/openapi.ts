export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Trazabilidad de Producción — API',
    version: '0.1.0',
    description:
      'API para trazabilidad de tela → lotes → tiendas → ventas. ' +
      'Todas las respuestas siguen el envelope `{ error: boolean, data?: any, mensaje?: string }`. ' +
      'La autorización se hace por `telefono` en el body (según el rol requerido por el endpoint).',
  },
  servers: [{ url: 'http://localhost:3001', description: 'Local' }],
  tags: [
    { name: 'Health' },
    { name: 'Tiendas' },
    { name: 'Productos' },
    { name: 'Tela' },
    { name: 'Lotes' },
    { name: 'Reportes' },
    { name: 'AuthorizedPhones' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Healthcheck',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'boolean', example: false },
                    data: {
                      type: 'object',
                      properties: { status: { type: 'string', example: 'ok' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/tiendas': {
      get: {
        tags: ['Tiendas'],
        summary: 'Listar tiendas',
        responses: {
          '200': {
            description: 'Listado de tiendas',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Tienda' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
    '/api/tiendas/stock': {
      get: {
        tags: ['Tiendas'],
        summary: 'Stock actual por tienda, agrupado por lote y talla',
        responses: {
          '200': {
            description: 'Stock por tienda',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/StockTienda' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },

    '/api/productos': {
      get: {
        tags: ['Productos'],
        summary: 'Listar productos',
        responses: {
          '200': {
            description: 'Listado de productos',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Producto' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Productos'],
        summary: 'Crear producto',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CrearProductoInput' },
              example: { nombre: 'Vestido Niña', descripcion: 'Vestido escolar talla infantil' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Producto creado',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Producto' } },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '409': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/tela/stock': {
      get: {
        tags: ['Tela'],
        summary: 'Metros de tela disponibles, desglosado por tipo de tela',
        description:
          'Sin query param "tipo": devuelve un arreglo con el disponible por cada tipo de ' +
          'tela que tenga ingresos. Con "tipo": devuelve solo ese tipo (404 si no existe en ' +
          'el catálogo de TipoTela).',
        parameters: [
          {
            name: 'tipo',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Nombre del tipo de tela (case-insensitive). Filtra a un solo resultado.',
          },
        ],
        responses: {
          '200': {
            description: 'Disponible por tipo (arreglo) o de un tipo especifico (objeto)',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          oneOf: [
                            { type: 'array', items: { $ref: '#/components/schemas/StockTela' } },
                            { $ref: '#/components/schemas/StockTela' },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/tela/ingresos': {
      post: {
        tags: ['Tela'],
        summary: 'Registrar ingreso de tela de un tipo ya existente en el catálogo',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IngresoTelaInput' },
              example: {
                proveedor: 'Textiles ACME',
                metros: 120.5,
                tipoTela: 'Algodón Blanco',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Tela ingresada',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Tela' } },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '404': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/tipos-tela': {
      get: {
        tags: ['Tela'],
        summary: 'Listar tipos de tela',
        responses: {
          '200': {
            description: 'Listado de tipos de tela',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: {
                        data: { type: 'array', items: { $ref: '#/components/schemas/TipoTela' } },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Tela'],
        summary: 'Crear tipo(s) de tela',
        description:
          'Mismo patrón que /api/productos: "nombre" como string simple (uno), string con ' +
          'comas o arreglo de strings (varios de una vez, nunca falla por duplicados).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CrearTipoTelaInput' },
              example: { nombre: 'Algodón Blanco' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Tipo(s) de tela creado(s)',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    { type: 'object', properties: { data: { $ref: '#/components/schemas/TipoTela' } } },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '409': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/lotes': {
      post: {
        tags: ['Lotes'],
        summary: 'Crear lote. Descuenta tela FIFO por fechaIngreso, solo dentro del tipoTela pedido.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CrearLoteInput' },
              example: {
                producto: 'Polo básico',
                tipoTela: 'Algodón Blanco',
                metrosTela: 30,
                tipo: 'STOCK',
                tallas: [
                  { talla: 'S', cantidad: 10 },
                  { talla: 'M', cantidad: 15 },
                  { talla: 'L', cantidad: 8 },
                ],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Lote creado',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Lote' } },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '403': { $ref: '#/components/responses/BusinessError' },
          '404': { $ref: '#/components/responses/BusinessError' },
        },
      },
      get: {
        tags: ['Lotes'],
        summary: 'Listar lotes (filtros opcionales)',
        parameters: [
          {
            name: 'estado',
            in: 'query',
            schema: { $ref: '#/components/schemas/EstadoLote' },
          },
          {
            name: 'tipo',
            in: 'query',
            schema: { $ref: '#/components/schemas/TipoLote' },
          },
        ],
        responses: {
          '200': {
            description: 'Listado de lotes (resumen)',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/LoteResumen' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/lotes/{codigo}': {
      get: {
        tags: ['Lotes'],
        summary: 'Obtener detalle de lote por código',
        parameters: [{ $ref: '#/components/parameters/CodigoLote' }],
        responses: {
          '200': {
            description: 'Detalle del lote',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/LoteDetalle' } },
                    },
                  ],
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/lotes/{codigo}/avance': {
      post: {
        tags: ['Lotes'],
        summary:
          'Avanzar lote de estado (CORTADOR: CORTE→COSTURA, COSTURA: COSTURA→ACABADO, ACABADO: ACABADO→ALMACEN)',
        parameters: [{ $ref: '#/components/parameters/CodigoLote' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TelefonoInput' },
              example: { telefono: '555-0003' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Lote avanzado',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Lote' } },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '404': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/lotes/{codigo}/transferencias': {
      post: {
        tags: ['Lotes'],
        summary: 'Transferir unidades del almacén a una tienda (rol ALMACEN)',
        parameters: [{ $ref: '#/components/parameters/CodigoLote' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TransferirLoteInput' },
              example: {
                telefono: '555-0004',
                tienda: 'Tienda Centro',
                talla: 'M',
                cantidad: 5,
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Transferencia registrada',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Transferencia' } },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '403': { $ref: '#/components/responses/BusinessError' },
          '404': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/lotes/{codigo}/ventas': {
      post: {
        tags: ['Lotes'],
        summary:
          'Registrar venta en la tienda del vendedor (rol VENDEDOR). Auto-finaliza lotes STOCK con stock total en 0.',
        parameters: [{ $ref: '#/components/parameters/CodigoLote' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/VenderLoteInput' },
              example: { telefono: '555-0005', talla: 'M', cantidad: 1 },
            },
          },
        },
        responses: {
          '201': {
            description: 'Venta registrada',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Venta' } },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '403': { $ref: '#/components/responses/BusinessError' },
          '404': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/lotes/{codigo}/finalizar': {
      post: {
        tags: ['Lotes'],
        summary: 'Finalizar manualmente un lote tipo PEDIDO (rol ALMACEN)',
        parameters: [{ $ref: '#/components/parameters/CodigoLote' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TelefonoInput' },
              example: { telefono: '555-0004' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Lote finalizado',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/Lote' } },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '403': { $ref: '#/components/responses/BusinessError' },
          '404': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/reportes/produccion': {
      get: {
        tags: ['Reportes'],
        summary: 'Reporte de producción por rango de fechas',
        parameters: [
          { $ref: '#/components/parameters/Desde' },
          { $ref: '#/components/parameters/Hasta' },
        ],
        responses: {
          '200': {
            description: 'Reporte de producción',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EnvelopeAny' } } },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },
    '/api/reportes/movimientos': {
      get: {
        tags: ['Reportes'],
        summary: 'Reporte de transferencias y ventas',
        parameters: [
          { $ref: '#/components/parameters/Desde' },
          { $ref: '#/components/parameters/Hasta' },
          { name: 'tienda', in: 'query', schema: { type: 'string' } },
          { name: 'producto', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Reporte de movimientos',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EnvelopeAny' } } },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },
    '/api/reportes/ciclo-lotes': {
      get: {
        tags: ['Reportes'],
        summary: 'Estadísticas de tiempo de ciclo por fase para lotes FINALIZADO',
        parameters: [
          { $ref: '#/components/parameters/Desde' },
          { $ref: '#/components/parameters/Hasta' },
        ],
        responses: {
          '200': {
            description: 'Reporte de ciclo de lotes',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/EnvelopeAny' } } },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },

    '/api/authorized-phones': {
      post: {
        tags: ['AuthorizedPhones'],
        summary: 'Autorizar un nuevo teléfono y generar su código de verificación',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthorizedPhoneInput' },
              example: { phone: '555-0006' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Teléfono autorizado, incluye el codeVerification a enviar al usuario',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/Envelope' },
                    {
                      type: 'object',
                      properties: { data: { $ref: '#/components/schemas/AuthorizedPhone' } },
                    },
                  ],
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BusinessError' },
          '409': { $ref: '#/components/responses/BusinessError' },
        },
      },
    },
  },

  components: {
    parameters: {
      CodigoLote: {
        name: 'codigo',
        in: 'path',
        required: true,
        schema: { type: 'string', example: 'LOTE-2026-0001' },
      },
      Desde: {
        name: 'desde',
        in: 'query',
        description: 'Fecha ISO 8601 (ej. 2026-08-01)',
        schema: { type: 'string', format: 'date' },
      },
      Hasta: {
        name: 'hasta',
        in: 'query',
        description: 'Fecha ISO 8601 (ej. 2026-08-31)',
        schema: { type: 'string', format: 'date' },
      },
    },
    responses: {
      BusinessError: {
        description: 'Error de negocio',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: true, mensaje: 'telefono es requerido y debe ser un string no vacío' },
          },
        },
      },
    },
    schemas: {
      Envelope: {
        type: 'object',
        properties: { error: { type: 'boolean', example: false } },
      },
      EnvelopeAny: {
        type: 'object',
        properties: {
          error: { type: 'boolean', example: false },
          data: { type: 'object', additionalProperties: true },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'boolean', example: true },
          mensaje: { type: 'string' },
        },
      },

      EstadoLote: {
        type: 'string',
        enum: ['CORTE', 'COSTURA', 'ACABADO', 'ALMACEN', 'FINALIZADO'],
      },
      TipoLote: { type: 'string', enum: ['STOCK', 'PEDIDO'] },
      Rol: {
        type: 'string',
        enum: ['CORTADOR', 'COSTURA', 'ACABADO', 'ALMACEN', 'VENDEDOR'],
      },

      TelefonoInput: {
        type: 'object',
        required: ['telefono'],
        properties: { telefono: { type: 'string', example: '555-0001' } },
      },

      AuthorizedPhoneInput: {
        type: 'object',
        required: ['phone'],
        properties: { phone: { type: 'string', example: '555-0006' } },
      },
      AuthorizedPhone: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          phone: { type: 'string' },
          codeVerification: { type: 'string', example: '482913' },
          lastCodeVerificationAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      Tienda: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
        },
      },
      StockTienda: {
        type: 'object',
        properties: {
          tienda: { type: 'string' },
          totalUnidades: { type: 'integer' },
          lotes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigo: { type: 'string' },
                producto: { type: 'string' },
                tallas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      talla: { type: 'string' },
                      cantidad: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      Producto: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          descripcion: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      CrearProductoInput: {
        type: 'object',
        required: ['nombre'],
        description:
          '"nombre" puede ser: un string sin comas (crea un solo producto, 409 si ya existe), ' +
          'un string con comas (crea varios, una coma por nombre), o un arreglo de strings ' +
          '(igual que el string con comas). En los dos casos de "varios" nunca falla por ' +
          'duplicados — cada nombre reporta si se creó o si ya existía en "data". Todos los ' +
          'nombres se guardan tal cual se enviaron, pero la comparación para detectar ' +
          'duplicados y para buscarlos despues (ej. al crear un lote) ignora mayúsculas/' +
          'minúsculas.',
        properties: {
          nombre: {
            oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
          },
          descripcion: { type: 'string', nullable: true, description: 'Solo aplica para creación individual.' },
        },
      },

      IngresoTelaInput: {
        type: 'object',
        required: ['proveedor', 'metros', 'tipoTela'],
        properties: {
          proveedor: { type: 'string' },
          metros: { type: 'number', minimum: 0, exclusiveMinimum: true },
          tipoTela: { type: 'string', description: 'Nombre de un TipoTela ya existente (case-insensitive).' },
        },
      },
      TipoTela: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nombre: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CrearTipoTelaInput: {
        type: 'object',
        required: ['nombre'],
        properties: {
          nombre: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
        },
      },
      StockTela: {
        type: 'object',
        properties: {
          tipoTela: { type: 'string' },
          metrosDisponibles: { type: 'number' },
        },
      },
      Tela: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          tipoTelaId: { type: 'integer' },
          proveedor: { type: 'string' },
          metrosIngresados: { type: 'number' },
          metrosDisponibles: { type: 'number' },
          fechaIngreso: { type: 'string', format: 'date-time' },
        },
      },

      TallaCantidad: {
        type: 'object',
        required: ['talla', 'cantidad'],
        properties: {
          talla: { type: 'string', example: 'M' },
          cantidad: { type: 'integer', minimum: 1 },
        },
      },
      CrearLoteInput: {
        type: 'object',
        required: ['producto', 'tipoTela', 'metrosTela', 'tallas'],
        properties: {
          producto: { type: 'string' },
          tipoTela: { type: 'string', description: 'Nombre de un TipoTela ya existente (case-insensitive). El FIFO solo consume tela de este tipo.' },
          metrosTela: { type: 'number', minimum: 0, exclusiveMinimum: true },
          tipo: { $ref: '#/components/schemas/TipoLote' },
          tallas: {
            type: 'array',
            minItems: 1,
            items: { $ref: '#/components/schemas/TallaCantidad' },
          },
        },
      },
      TransferirLoteInput: {
        type: 'object',
        required: ['telefono', 'tienda', 'talla', 'cantidad'],
        properties: {
          telefono: { type: 'string' },
          tienda: { type: 'string' },
          talla: { type: 'string' },
          cantidad: { type: 'integer', minimum: 1 },
        },
      },
      VenderLoteInput: {
        type: 'object',
        required: ['telefono', 'talla', 'cantidad'],
        properties: {
          telefono: { type: 'string' },
          talla: { type: 'string' },
          cantidad: { type: 'integer', minimum: 1 },
        },
      },

      Lote: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          codigo: { type: 'string' },
          productoId: { type: 'integer' },
          tipoTelaId: { type: 'integer' },
          metrosTelaUsados: { type: 'number' },
          estado: { $ref: '#/components/schemas/EstadoLote' },
          tipo: { $ref: '#/components/schemas/TipoLote' },
          fechaCreacion: { type: 'string', format: 'date-time' },
          fechaCostura: { type: 'string', format: 'date-time', nullable: true },
          fechaAcabado: { type: 'string', format: 'date-time', nullable: true },
          fechaAlmacen: { type: 'string', format: 'date-time', nullable: true },
          fechaFinalizacion: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      LoteResumen: {
        type: 'object',
        properties: {
          codigo: { type: 'string' },
          producto: { type: 'string' },
          estado: { $ref: '#/components/schemas/EstadoLote' },
          tipo: { $ref: '#/components/schemas/TipoLote' },
          unidadesTotales: { type: 'integer' },
          fechaCreacion: { type: 'string', format: 'date-time' },
          fechaFinalizacion: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      LoteDetalle: {
        type: 'object',
        properties: {
          codigo: { type: 'string' },
          producto: { type: 'string' },
          estado: { $ref: '#/components/schemas/EstadoLote' },
          tipo: { $ref: '#/components/schemas/TipoLote' },
          metrosTelaUsados: { type: 'number' },
          fechaCreacion: { type: 'string', format: 'date-time' },
          fechaFinalizacion: { type: 'string', format: 'date-time', nullable: true },
          detalleTallas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                talla: { type: 'string' },
                cantidadInicial: { type: 'integer' },
                stockAlmacen: { type: 'integer' },
                stocksEnTiendas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tienda: { type: 'string' },
                      cantidad: { type: 'integer' },
                    },
                  },
                },
                transferencias: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tienda: { type: 'string' },
                      cantidad: { type: 'integer' },
                      fecha: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                ventas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tienda: { type: 'string' },
                      cantidad: { type: 'integer' },
                      fecha: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      Transferencia: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          loteDetalleId: { type: 'integer' },
          tiendaId: { type: 'integer' },
          cantidad: { type: 'integer' },
          fecha: { type: 'string', format: 'date-time' },
        },
      },
      Venta: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          loteDetalleId: { type: 'integer' },
          tiendaId: { type: 'integer' },
          cantidad: { type: 'integer' },
          fecha: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const;

import { PrismaClient, Rol } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const nombresTiendas = ['Tienda Centro', 'Tienda Norte', 'Tienda Sur'];
  const tiendas = await Promise.all(
    nombresTiendas.map((nombre) =>
      prisma.tienda.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      })
    )
  );

  const productos = [
    { nombre: 'Vestido Escolar', descripcion: 'Vestido uniforme escolar niña' },
    { nombre: 'Polo Escolar', descripcion: 'Polo uniforme escolar unisex' },
    { nombre: 'Blusa Ejecutiva', descripcion: 'Blusa formal para oficina' },
  ];
  await Promise.all(
    productos.map((p) =>
      prisma.producto.upsert({
        where: { nombre: p.nombre },
        update: { descripcion: p.descripcion },
        create: p,
      })
    )
  );

  const nombresTiposTela = ['Algodón Blanco', 'Poliéster Negro', 'Denim Azul'];
  const tiposTela = await Promise.all(
    nombresTiposTela.map((nombre) =>
      prisma.tipoTela.upsert({
        where: { nombre },
        update: {},
        create: { nombre },
      })
    )
  );

  const tiendaVendedor = tiendas[0];
  const usuarios: { telefono: string; rol: Rol; tiendaId: number | null }[] = [
    { telefono: 'TEST-CORTADOR-001', rol: Rol.CORTADOR, tiendaId: null },
    { telefono: 'TEST-COSTURA-001', rol: Rol.COSTURA, tiendaId: null },
    { telefono: 'TEST-ACABADO-001', rol: Rol.ACABADO, tiendaId: null },
    { telefono: 'TEST-ALMACEN-001', rol: Rol.ALMACEN, tiendaId: null },
    { telefono: 'TEST-VENDEDOR-001', rol: Rol.VENDEDOR, tiendaId: tiendaVendedor.id },
  ];

  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { telefono: u.telefono },
      update: { rol: u.rol, tiendaId: u.tiendaId },
      create: u,
    });
  }

  console.log(
    `Seed OK: ${tiendas.length} tiendas, ${productos.length} productos, ${tiposTela.length} tipos de tela, ${usuarios.length} usuarios`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

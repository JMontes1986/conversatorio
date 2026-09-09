# Conversatorio Colgemelli

Plataforma de debate intercolegial construida con **Next.js, Supabase y Vercel**.

Incluye administración de colegios, jurados y moderadores, rondas, rúbrica, sorteo, marcador, control del debate, videos, preguntas del público, encuestas y auditoría.

## Configuración

1. Crea un proyecto en Supabase y ejecuta [`supabase/schema.sql`](supabase/schema.sql) completo en SQL Editor.
2. Crea el primer usuario en Authentication y asígnale el rol con [`supabase/create-admin.sql`](supabase/create-admin.sql).
3. Copia [`.env.example`](.env.example) a `.env.local` y completa las variables.
4. Usa Node.js 24 y ejecuta `npm ci` y `npm run dev`.
5. Importa el repositorio en Vercel y configura las mismas variables.

**[Guía completa: Supabase, cuentas, permisos, videos y despliegue](docs/SUPABASE-VERCEL.md).**

## Comprobaciones

```sh
npm run typecheck
npm run test:schema
npm run build
```

La prueba de SQL verifica políticas de acceso y operaciones reales en PostgreSQL embebido. El schema crea 15 tablas de datos, perfiles de usuarios, índices, funciones, políticas RLS, Realtime y Storage. La estructura de cada módulo se conserva en columnas JSONB.

Los administradores entran con correo/contraseña; jurados con cédula/token; moderadores con usuario/token. Las cuentas se crean desde administración y se autentican con Supabase Auth.

**El schema prepara una base nueva; no importa automáticamente los datos ni las cuentas de sistemas anteriores.**

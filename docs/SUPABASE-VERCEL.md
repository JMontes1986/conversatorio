# Configuración de Supabase y Vercel

## 1. Crear la base

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**, copia **todo** el contenido de [`supabase/schema.sql`](../supabase/schema.sql) y ejecútalo.
3. El script crea tablas, índices, funciones, políticas RLS, datos iniciales, la publicación Realtime y el bucket público `debate-media`.
4. Puedes repetirlo: conserva los registros existentes. Está diseñado para un proyecto nuevo dedicado a Conversatorio; no debe mezclarse con otro sistema que tenga tablas del mismo nombre.

Las tablas usan `id`, `data JSONB`, `created_at` y `updated_at`. `data` mantiene la estructura de los formularios existentes (equipos, participantes, preguntas de encuesta y llaves del torneo). Es almacenamiento PostgreSQL nativo; la aplicación ya no requiere el SDK ni los servicios de Firebase. Las operaciones se ejecutan en Supabase y las transacciones conservan juntos los cambios de cada lote.

| Tabla | Contenido | Lectura |
|---|---|---|
| `profiles` | Usuario de Auth, rol y registro de jurado/moderador asociado | Perfil propio; gestión desde servidor |
| `schools` | Colegio, equipo, contacto, participantes, asistentes y estado | Administrador y moderador |
| `judges` | Nombre, cédula, token y estado del jurado | Administrador |
| `moderators` | Usuario, token y estado del moderador | Administrador |
| `scores` | Ronda, jurado, equipos, totales y detalle de criterios | Organizadores, jurado propio y público cuando se publica la fase |
| `rounds` | Nombre y fase de la ronda | Pública |
| `rubric` | Criterios de evaluación | Pública |
| `questions` | Preguntas preparadas y videos | Organizadores; el público solo ve la pregunta activa |
| `student_questions` | Preguntas enviadas por espectadores | Organizadores |
| `survey_responses` | Respuestas de encuesta | Administrador |
| `site_content` | Documentos `home`, `schedule`, `survey` | Pública |
| `settings` | Documento `competition`: inscripción, equipos y publicación | Pública |
| `debate_state` | Documento `current`: ronda, equipos, pantalla y temporizador | Pública |
| `draw_state` | Estado del sorteo | Pública |
| `tiebreak` | Estado del desempate | Pública |
| `audit_logs` | Acciones con usuario y fecha de servidor | Administrador |

Los resultados solo se leen públicamente si la fase correspondiente está publicada. Los documentos públicos de sorteo y debate son para proyección: no guardes allí contraseñas ni datos privados. Los tokens de jurados/moderadores solo son consultables por administradores.

## 2. Crear el primer administrador

1. Ve a **Authentication → Users → Add user** y crea un usuario con correo y contraseña. Marca el correo como confirmado.
2. Abre [`supabase/create-admin.sql`](../supabase/create-admin.sql), reemplaza `REEMPLAZAR_POR_TU_CORREO` por ese correo y ejecútalo.
3. En la configuración de Auth, deja habilitado el acceso con correo/contraseña y desactiva el registro público (**Allow new users to sign up**). Las cuentas se crean desde el panel.
4. No necesitas activar usuarios anónimos ni configurar proveedores de Google.

Crear un usuario en Auth por sí solo no le da permisos de administrador. El acceso depende de `profiles`. Nadie puede asignarse un rol desde el navegador.

## 3. Variables de entorno

En Supabase, copia la URL del proyecto y las claves desde **Connect / Settings → API Keys**. Usa las claves del mismo proyecto donde ejecutaste el SQL.

| Variable | Valor | Dónde se utiliza |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://TU_PROYECTO.supabase.co` | Navegador y servidor |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave `sb_publishable_...` | Navegador, protegida por RLS |
| `SUPABASE_SECRET_KEY` | Clave `sb_secret_...` | Solo servidor: creación/eliminación de cuentas |
| `NEXT_PUBLIC_SITE_URL` | URL definitiva de Vercel o dominio propio | Sitemap y robots |

Para proyectos con claves antiguas se admiten `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en lugar de las claves nuevas. Configura un solo par. Nunca uses `NEXT_PUBLIC_` para la clave secreta ni la guardes en Git.

Para desarrollo, copia [`.env.example`](../.env.example) a `.env.local`, completa los valores y ejecuta:

```sh
npm ci
npm run dev
```

El proyecto usa Node.js 24. Reinicia el servidor después de cambiar `.env.local`.

## 4. Desplegar en Vercel

1. Guarda los cambios en tu repositorio e impórtalo en Vercel con **Add New → Project**.
2. Selecciona **Next.js**, directorio raíz `.` y Node.js **24.x**.
3. Configura las cuatro variables anteriores para Production y, si lo utilizarás, Preview. Usa una base separada para pruebas si no quieres que una vista previa edite la competencia real.
4. Despliega. [`vercel.json`](../vercel.json) configura `npm ci` y `npm run build`.
5. En Supabase → Authentication → URL Configuration, establece **Site URL** con el dominio definitivo. Agrega `http://localhost:3000` y los dominios de preview que necesites a las URLs de redirección.
6. Abre `/admin/login` con el usuario creado en el paso 2.

Si asignas el dominio definitivo después del primer despliegue, actualiza `NEXT_PUBLIC_SITE_URL` y vuelve a desplegar. Las variables `NEXT_PUBLIC_` se incorporan al compilar.

## 5. Preparar la competencia

- Registra colegios y verifica los equipos desde administración. El formulario `/register` mantiene su acceso de administrador.
- Crea rondas y criterios de evaluación.
- Crea jurados: introduce nombre y cédula, luego usa **Copiar token**. El jurado ingresa en `/scoring/login` con cédula y token.
- Crea moderadores: reciben usuario y token y acceden en `/moderator/login`.
- Los tokens se generan en el servidor; las contraseñas de autenticación se gestionan en Supabase Auth. Los correos internos terminados en `@participants.conversatorio.invalid` identifican las cuentas de jurados/moderadores y no reciben mensajes.
- Activar/desactivar un jurado o moderador modifica sus permisos en la base inmediatamente. El panel revisa la sesión cada 15 segundos y al volver a la pestaña.
- Puedes crear administradores adicionales en `/admin/crear-usuario`; el formulario no cambia tu sesión actual.
- Edita inicio, programación y encuesta. La encuesta empieza desactivada.
- Los videos se cargan directamente en Supabase Storage, hasta **50 MB**, sin pasar por una función de Vercel. Se admiten MP4, WebM, Ogg y QuickTime; para reproducción amplia usa MP4 o WebM. El bucket también acepta PNG, JPEG y WebP que puedes subir desde Supabase y enlazar en los editores.

## 6. Verificación

```sh
npm run typecheck
npm run test:schema
npm run build
```

La prueba SQL usa PostgreSQL embebido (PGlite) y objetos mínimos que representan Auth/Storage de Supabase. Ejecuta el schema real y verifica RLS, usuarios sin rol, desactivación, validación de puntuaciones, publicación, cargas y transacciones. No sustituye la comprobación con tu proyecto remoto de Auth, Storage y Realtime.

Después de configurar Supabase, comprueba desde dos navegadores o perfiles distintos: administrador, jurado y moderador; crea una ronda, puntúala y verifica el marcador; oculta/publica resultados; envía una pregunta por QR; responde una encuesta; sube y reproduce un video. Dos ventanas normales del mismo navegador comparten la sesión de Supabase.

## Datos anteriores

Este cambio prepara la aplicación y una base nueva. **El SQL no copia los datos, usuarios ni videos existentes en Firebase.** No se accedió al proyecto antiguo. Si necesitas conservar el historial, exporta las colecciones y archivos antes de retirar ese servicio y prepara su importación manteniendo los IDs y las relaciones. Las contraseñas de Firebase no se copian con este schema; los administradores, jurados y moderadores deben aprovisionarse en Supabase. Los enlaces de videos antiguos deben sustituirse por los de Storage.

Los logotipos que ya apuntaban a un bucket externo de Supabase conservan sus URLs. Puedes copiarlos a `debate-media` y cambiar los enlaces si también quieres que esos recursos pertenezcan al proyecto nuevo.

Referencias oficiales: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Realtime](https://supabase.com/docs/guides/realtime/postgres-changes), [claves API](https://supabase.com/docs/guides/getting-started/api-keys), [Next.js en Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

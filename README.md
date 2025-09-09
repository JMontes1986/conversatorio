# Plataforma de Debate Intercolegial - Conversatorio Colgemelli

Esta es una aplicación web full-stack construida con Next.js y Firebase, diseñada para gestionar de manera integral una competencia de debate intercolegial. La plataforma ofrece una experiencia completa tanto para los organizadores y participantes como para el público general.

## Tecnologías Principales

- **Framework:** [Next.js](https://nextjs.org/) (con App Router)
- **UI:** [ShadCN/UI](https://ui.shadcn.com/) y [Tailwind CSS](https://tailwindcss.com/)
- **Base de Datos y Autenticación:** [Firebase](https://firebase.google.com/) (Firestore, Authentication, Storage)
- **Estado y Formularios:** [React Hook Form](https://react-hook-form.com/) y [Zod](https://zod.dev/)
- **Despliegue:** El código fuente se gestiona en [GitHub](https://github.com/) y el despliegue se realiza a través de [Netlify](https://www.netlify.com/).

---

## Módulos y Funcionalidades

La aplicación se divide en varias áreas clave, cada una con un propósito específico y un nivel de acceso diferente.

### 1. Vistas Públicas

Estas secciones son accesibles para cualquier visitante sin necesidad de iniciar sesión.

- **Página de Inicio (`/`)**: Una página de bienvenida dinámica cuyo contenido (títulos, textos, características e imágenes del carrusel) es completamente editable desde el panel de administrador.
- **Marcador (`/scoreboard`)**: Muestra los resultados de la competencia en tiempo real. Incluye los resultados de la fase de grupos y un bracket del torneo que se actualiza automáticamente a medida que avanzan las rondas.
- **Sorteo en Vivo (`/draw`)**: Una pantalla pública que refleja en tiempo real el sorteo de equipos en las diferentes fases del torneo, creando una experiencia transparente y emocionante.
- **Página de Debate (`/debate`)**: Es la pantalla principal que los participantes y el público ven durante un debate. Muestra la pregunta activa, videos relacionados, mensajes del moderador y un temporizador sincronizado.

### 2. Roles de Usuario y Autenticación

El sistema cuenta con tres roles de usuario bien definidos para gestionar la competencia:

- **Administrador**: Tiene control total sobre todos los aspectos de la plataforma.
- **Moderador**: Controla el flujo en vivo del debate (temporizador, preguntas, videos).
- **Jurado**: Puede acceder a un panel específico para enviar las puntuaciones de las rondas.

### 3. Panel de Administrador (`/admin`)

Es el centro de control de la competencia. Es un panel protegido que requiere autenticación de administrador y está organizado en pestañas:

- **Home**: Permite editar todo el contenido de la página de inicio.
- **Colegios**: Permite registrar, ver, editar, eliminar y verificar los colegios participantes, sus equipos y sus listas de asistentes.
- **Rondas**: Para crear y eliminar las rondas del torneo, asignándolas a fases específicas (Ej: Fase de Grupos, Cuartos de Final).
- **Rúbrica**: Permite definir los criterios de evaluación (nombre y descripción) que los jueces utilizarán para calificar.
- **Sorteo**: Interfaz para realizar el sorteo automático de equipos, ya sea para la fase de grupos o para las fases eliminatorias.
- **Jurados**: Para registrar nuevos jurados con su nombre y cédula.
- **Moderadores**: Permite crear cuentas de moderador con un token de acceso único y gestionar su estado (activo/inactivo). También permite crear nuevos administradores.
- **Control del Debate**: Una vista de moderador completa integrada para el administrador.
- **Resultados**: Muestra un desglose detallado de las puntuaciones de cada ronda, con el total por equipo y el puntaje de cada juez.

### 4. Panel de Moderador (`/moderator`)

Interfaz simplificada y protegida para quienes dirigen los debates en vivo.

- **Acceso**: Mediante un nombre de usuario y un token de acceso único generado por el administrador.
- **Funcionalidades**:
    - **Gestión de Rondas y Sorteo**: Puede visualizar la configuración de las rondas y el resultado de los sorteos.
    - **Control del Debate**: Es la herramienta principal. Permite:
        - Seleccionar la ronda activa y los equipos que se enfrentan.
        - Controlar un temporizador global visible para todos los participantes.
        - Enviar preguntas preparadas o videos a la pantalla principal (`/debate`).
        - Enviar mensajes temporales.
        - Limpiar la pantalla de los participantes.
        - Subir videos y asociarlos a preguntas.

### 5. Panel de Puntuación del Jurado (`/scoring`)

Un portal seguro y sencillo para que los jueces califiquen las rondas.

- **Acceso**: Mediante el número de cédula del jurado.
- **Funcionalidades**:
    - Muestra la ronda activa y los equipos que se están enfrentando.
    - Presenta la rúbrica de evaluación definida por el administrador.
    - Permite al juez asignar una puntuación (de 1 a 5) a cada equipo por cada criterio.
    - Calcula el total automáticamente y lo envía a la base de datos.
    - Muestra un historial de las puntuaciones que el juez ha enviado en rondas anteriores.

---

## Cómo Empezar

Para ejecutar este proyecto en un entorno de desarrollo local:

1.  **Clonar el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd <NOMBRE_DEL_PROYECTO>
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Ejecutar la aplicación:**
    ```bash
    npm run dev
    ```

La aplicación estará disponible en `http://localhost:3000`.

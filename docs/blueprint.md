# **App Name**: Conversatorio Colgemelli

## Core Features:

- Registro de Escuelas: Permite a las escuelas registrarse en la competencia con los detalles necesarios.
- Sorteo Automático: Genera automáticamente un sorteo para las etapas de grupos y eliminación, utilizando una semilla y un nonce para la aleatoriedad verificable y la auditabilidad. Existirá una opción para fijar el resultado del sorteo a la blockchain. Incluye una interfaz de usuario animada para visualizar el sorteo.
- Envío de Video: Permite a cada escuela subir sus presentaciones de video para cada ronda, con validación de archivos (mp4/mov, límite de tamaño). Se obtiene una URL pre-firmada, para proporcionar una mayor seguridad, evitando las cargas directas al bucket.
- Panel de Control del Moderador: Proporciona un panel de control para que los moderadores gestionen cada ronda de debate, incluyendo el inicio del video, la visualización de la pregunta y la gestión de los temporizadores con alertas audibles. Permite mostrar el tiempo restante. Las configuraciones del temporizador se aplicarán utilizando una herramienta que decide qué configuración de tiempo elegir dependiendo de si la duración de la pregunta del tema y los temporizadores de intervención de la ronda no son nulos y son inferiores al límite máximo general del temporizador de la ronda.
- Puntuación basada en rúbrica: Permite a los jueces calificar a cada equipo basándose en una rúbrica configurable, con guardado en tiempo real y checksum para asegurar la integridad de los datos.
- Marcador en tiempo real: Muestra un marcador en tiempo real y una visualización de los brackets para la visualización pública, con datos históricos y enlaces a pruebas de integridad de la blockchain.
- Panel de Control de Administrador: Permite a los administradores gestionar las escuelas, los jueces, las rondas, las preguntas, los criterios de la rúbrica y la configuración de la competencia, con la integración de la blockchain para los rastros de auditoría.

## Style Guidelines:

- Color primario: Azul profundo (#3F51B5) para evocar confianza y profundidad intelectual.
- Color de fondo: Gris claro (#F5F5F5) para una sensación limpia y moderna.
- Color de acento: Naranja vibrante (#FF9800) para resaltar las acciones y elementos clave.
- Fuente del cuerpo: Fuente sans-serif 'Inter' con un aspecto neutro y moderno.
- Fuente del título: Fuente sans-serif 'Space Grotesk' para una sensación tecnológica, moderna y científica.
- Utilice iconos nítidos y profesionales para representar las acciones y los datos.
- Transiciones y animaciones sutiles para guiar al usuario a través de la aplicación.
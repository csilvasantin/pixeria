# Biblioteca de distribución · #4730 / FLT-101248

Entrada: `/demo/biblioteca/`. Catálogo público: `/demo/biblioteca/piezas.json`.

Solo reutiliza los dos vídeos y los dos audios ya publicados en Stock. Las
miniaturas son fotogramas extraídos del segundo 2 con ffmpeg; las duraciones
(45.205 y 59.600 segundos) se midieron con ffprobe. No se generó media.
El vídeo es la pieza principal; el audio se ofrece como hilo musical separado.
JTI se presenta como comercio de proximidad, sin tabaco. Todo el recorrido
está rotulado EJEMPLO.

`config.json` configura `distributionBase` (HTTPS). Cada enlace Distribuir añade
`pieza=<videoId>` y `piezas=<URL absoluta del catálogo de esta preview>`.
Las miniaturas del catálogo se resuelven con `new URL(item.miniatura, catalogURL)`;
`url` y `audioUrl` apuntan al media de Stock; `duration` / `duracion` son segundos.
CORS `*` permite leer este catálogo público sin credenciales desde admira.app y
cualquier preview de clearchannel-tv.pages.dev.

La excepción de acceso público del middleware solo permite las tres formas de
la entrada de biblioteca en subdominios preview de pixeria.pages.dev. El resto
de documentos conserva el control de sesión.

Desplegar exclusivamente con `wrangler pages deploy --project-name pixeria
--branch oraculo/demo-distribucion-biblioteca`. No usar deploy.sh ni main.

Validación de navegador: `node test/demo-biblioteca.cjs <URL de biblioteca>`.
Requiere Playwright (o PLAYWRIGHT_MODULE apuntando al módulo) y Chrome
(CHROME_PATH opcional). Comprueba carga y duración del vídeo, miniaturas, filtro,
viewport móvil, CORS desde Smith y clic real de ambas piezas hasta la ficha
correcta de distribución. No envía contenido a players.

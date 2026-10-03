# Adaptador y Pixie

Entrega de #4905 · FLT-101368. Rama de preview; no fusionar ni desplegar a producción.

Vídeo incluye el compositor de TikToks. Adaptador ocupa su anterior entrada de navegación. La ruta `/adaptaciones/` se conserva para enlaces existentes. `/en/adaptaciones/` contiene la interfaz inglesa; la ruta raíz usa español en admira.studio y dirige a inglés en pixeria.com y previews de Pages.

Elige un vídeo del índice Stock o súbelo desde tu equipo. También puedes abrir el creador de Vídeo. Selecciona formatos estándar (9:16, 16:9, 1:1, 4:5) o el perfil Altadis. Ajusta recorte, contener o expansión con fondo desenfocado, foco y zoom. Cada tarjeta muestra resolución, uso, pérdida efectiva del encuadre y una receta H.264 plegable.

El perfil Altadis contiene las 18 filas no marcadas ESPECIAL de la página 3 de «ALTADIS Resoluciones y formatos», incluyendo Shuttle Stretch (SEDE). Fuente recuperada del archivo «Resoluciones y formatos especiales .pdf» aportado por Carlos en Telegram Desktop del MacMini. SHA-256 y filas transcritas: `adaptaciones/altadis-18.json`. Mantiene las resoluciones nativas, H.264/MP4 y 25 fps. Los cinco layouts especiales segmentados requieren un adaptador distinto; no se presentan como formatos estándar. Sincro VW y LOGO requieren duración coincidente; no se sincronizan players desde esta página.

La cuadrícula es una previsualización canvas local. No exporta los ajustes a MP4 ni rellena con IA generativa. La expansión repite y desenfoca el propio vídeo. El plan es una receta ffmpeg; bitrate y FPS de entrada son estimaciones. Los renders JTI listos son archivos reales previamente publicados en Stock, incluyendo 1:1 H.264 1080×1080 y 4:5 H.264 1080×1350, contrastados con ffprobe. No se regeneran al mover los controles. Vídeos remotos pueden fallar por CORS, retirada del asset o incompatibilidad del navegador; la subida local sigue disponible.

Pixie es una ilustración SVG local con animación CSS, sin modelos ni API de pago. Se invoca desde Experto con `/avatarDigital on` (o `/digitalAvatar on`) y se oculta con `off` o ×. Cada navegación empieza oculta; no restaura preferencias antiguas. Es una guía local con texto de ayuda, sin conversación IA ni acceso a micrófono. Respeta reducir movimiento.

El minitutorial se genera con ADmira Motion en el generador oficial admiranext.com/tiktok. Es una guía animada, no una grabación real de pantalla. El vídeo exportado y las capturas se vinculan al informe de Yokup tras verificarlos.

La preview incluye un paquete de revisión explícitamente público en `/review/4905/en/adaptaciones/` y `/review/4905/es/adaptaciones/`, con Vídeo en el mismo directorio. Se genera únicamente en un archivo temporal con `scripts/preview-4905.py`; no modifica la verja, los callbacks ni las rutas existentes. Los assets y la muestra ya son públicos. Esto permite revisar los cambios aunque el callback Google existente regrese a producción y rechace la sesión de preview.

# Compartir ▸ YouTube (Stock)

Botón **📤 Compartir** en el visor (lightbox) de cualquier vídeo del Stock, incluidas las Cápsulas.
Abre un modal con título, descripción y privacidad (por defecto *Oculto/unlisted*) y llama a
`POST /api/youtube/upload` (Pages Function). También ofrece **🔗 Compartir enlace** (Web Share API o copiar al portapapeles).

## Endpoint
- `GET /api/youtube/upload` → `{conectado: true|false}`.
- `POST /api/youtube/upload {id, title?, description?, privacyStatus?}` → `{ok, id, url}`.
- Requiere sesión de Pixeria de **superusuario** (o la sesión de agente) y mismo origen.
- Busca el asset en `https://stock.admira.store/stock/index.json`, solo acepta vídeos servidos desde `stock.admira.store`,
  y hace `videos.insert` con subida reanudable, pasando el MP4 en streaming (sin cargarlo en memoria).
  La descripción incluye `Fuente: <url del asset>`; los tags del asset pasan a tags de YouTube.
- Sin secretos responde `503 {"error":"youtube-no-conectado","mensaje":"YouTube no conectado"}` y el botón queda desactivado.

## Configuración única (Carlos)
1. Google Cloud Console → proyecto (p. ej. `admira-youtube`) → *APIs y servicios* → habilitar **YouTube Data API v3**.
2. *Pantalla de consentimiento OAuth*: tipo Externo (o Interno si es Workspace), añadir el scope
   `https://www.googleapis.com/auth/youtube.upload`, y añadir tu cuenta como *usuario de prueba*.
   **Importante:** en modo «Testing» el refresh token caduca a los 7 días → publicar la app («In production»).
   Sin verificación de Google, los vídeos subidos por apps no auditadas quedan **bloqueados como privados**;
   para poder publicar unlisted/public hay que pedir la auditoría de la API («YouTube API Services audit»).
3. *Credenciales* → crear **ID de cliente OAuth** tipo *Aplicación web*, URI de redirección
   `https://developers.google.com/oauthplayground`.
4. Obtener el refresh token en <https://developers.google.com/oauthplayground>: ⚙ → «Use your own OAuth credentials»
   (client id/secret) → scope `https://www.googleapis.com/auth/youtube.upload` → *Authorize* con la cuenta
   **dueña o gestora del canal** de Admira (elegir el canal/cuenta de marca correcto) → *Exchange authorization code for tokens*
   → copiar `refresh_token`.
5. Guardar como secretos del proyecto Pages `pixeria` (Production y Preview):
   ```
   npx wrangler pages secret put YOUTUBE_CLIENT_ID --project-name pixeria
   npx wrangler pages secret put YOUTUBE_CLIENT_SECRET --project-name pixeria
   npx wrangler pages secret put YOUTUBE_REFRESH_TOKEN --project-name pixeria
   ```
   (Y lo mismo en el proyecto de admira.studio si el espejo debe poder publicar.)

## Cuota
`videos.insert` cuesta **1600 unidades**; la cuota por defecto es **10.000 unidades/día** → ~6 subidas/día por proyecto.
Se reinicia a medianoche hora del Pacífico (09:00 Europe/Madrid). Más cuota: formulario de ampliación de la YouTube API.
Al agotarse, el endpoint responde `429 youtube-cuota`.

## Automatización (diseño, no implementado)
- **Opción A (preferida): hook en la subida.** Cuando el Worker de `api.admira.store` publique un asset `type=capsula`
  (o vídeo con tag `capsula`), encola `{id}` en una Cloudflare Queue; un consumidor llama a la misma lógica
  (`functions/_youtube.js`) y guarda `youtubeId` en el asset (para no subirlo dos veces).
- **Opción B: cron.** Un Worker con *Cron Trigger* (p. ej. cada hora) lee `stock/index.json`, filtra cápsulas
  con vídeo y sin `youtubeId`, y sube hasta N por ejecución (N ≤ 5 por la cuota).
- En ambos casos: privacidad por defecto `unlisted`, idempotencia por `youtubeId`, reintento al día siguiente si `quotaExceeded`,
  y un registro (KV/D1) de lo publicado.

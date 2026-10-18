# El Creativo · cola musical y partes del consejero

Studio guarda la letra y el encargo. La creación se realiza desde el navegador Suno del consejero. Studio no llama a `/suno/generate` ni instala claves del MCP del Consejo.

## Acceso existente

Origen: `https://admira.studio/creativo-music/`. Todas las rutas requieren la sesión habitual de Studio, por cookie HttpOnly. El operador usa su acceso **existente** (cuenta superusuario o sesión de agente); el usuario normal solo puede crear/ver sus propios encargos. La entrada de servicio ya existente es `POST /auth/agente`, cabecera `Authorization: Bearer <token de acceso de agente existente>`, `X-Agente: <nombre>`, guardando su cookie. No copiar este token a Studio, a una URL o al navegador del usuario. No se crea una clave nueva. Ante fallo de sesión no generar ni reintentar una recogida.

## Contrato

- `POST generate`: `{request_id,lyrics,voice:"chico"|"chica",languages:["ESP"|"ENG"],style,title}`. Es una reserva, **no una llamada a Suno**. Mismo id y contenido devuelve el mismo registro, incluso terminado; otro contenido o propietario responde 409. `request_id` permanece durante toda la vida del encargo.
- `POST track`: mismo cuerpo, registra un intento anterior como `action:"audit_only"`. Se consulta/audita la biblioteca; nunca autoriza nueva generación. Un registro auditado no se puede convertir en creación.
- `GET status?request_id=<id>`: estado del usuario. Solo consulta. `submitted_at` indica envío a la cola; `tracking_at` indica alta del seguimiento; no confundirlos con inicio en Suno.
- **Operador:** `GET queue` devuelve `{requests:[...]}`. Cada registro incluye `song` con letra/atributos, `action`, tiempos, fase, revisión y `claimed_at`. Revisar `action` antes de actuar. Los ya recogidos se consultan, nunca se reclaman o ejecutan otra vez.
- **Operador:** `POST claim` con `{request_id}`. Una sola recogida atómica; devuelve `claim_token`, `revision` y `song`. Guardar en almacenamiento privado duradero **antes de actuar**. Si devuelve 409 o la respuesta es incierta, NO volver a crear ni repetir un clic. No hay caducidad/reasignación automática del claim.
- **Operador:** `POST progress` con `{request_id,claim_token,revision,phase,message,encargo?,started_at?,remaining_min_seconds?,remaining_max_seconds?,eta_basis?,clips?}`. Devuelve la nueva revisión. Solo la cuenta que recogió puede actualizar con su claim; partes atrasados dan 409. Antes de publicar, consultar el estado actual si hay duda; nunca repetir generación como consecuencia de un fallo de actualización.

Fases: `en_cola` (servidor), `recibido` (claim), `auditoria`, `en_suno`, `generando`, `recuperando_audio`, `terminado`, `bloqueado`, `sin_confirmar`.

**Antes del único clic Crear en Suno**, confirmar el parte `en_suno`. El servidor fija `generation_attempted_at` y `started_at` si falta. Un nuevo `en_suno` es rechazado una vez marcado; perder confirmación no autoriza el clic ni el reenvío. Si hay incertidumbre, `sin_confirmar` y comprobar biblioteca. Esta reserva evita duplicar encargos/recogidas; no convierte en transacción atómica la UI de Suno. El ejecutor también debe respetar la regla de no reintento.

`audit_only` rechaza `en_suno` y `generando`. Al auditar, informar con `auditoria` y `encargo` existente. Si se encuentran canciones, recuperar sus clips y terminar. Si no se encuentran, terminar la auditoría explicándolo; eso no habilita reenvío.

Los partes son snapshots: cada actualización reemplaza la fase/mensaje/estimación anterior; conserva inicio, intento y clips. No es necesario enviar toda la historia. `submitted_at`, `tracking_at`, `updated_at`, `claimed_at`, `finished_at` los fija el servidor. Inicio no puede estar en el futuro. `revision` evita retrocesos por respuestas antiguas. `claim_token` no aparece en estado ni cola y no debe salir en informes.

## Estimaciones y audio

Solo enviar los dos extremos del rango restante si existe base real; acompañar `eta_basis` (fuente, hasta 200 caracteres). Cada parte sin estimación la retira, evitando mantener un cálculo viejo. Studio resta el tiempo desde el parte, indica estimación superada si se agota y noticias desactualizadas tras 2 minutos. Ningún porcentaje ni tiempo restante se inventa.

`clips` admite hasta cuatro `{id,audio_url,title?}`; URL HTTPS de `suno.ai`/`suno.com` o subdominios, sin credenciales. `terminado` exige audio en creaciones nuevas. Finalizar una auditoría sin audio se conserva como auditoría finalizada, no canción creada. Un resultado terminado es inmutable y no se reejecuta.

Studio consulta cada 30 segundos (60 con la página oculta). El cronómetro se deriva de tiempos persistidos, no se reinicia al recargar. Se distingue espera total, generación y seguimiento de intentos antiguos. Las locuciones conservan el flujo previo.

## Coordinación

Jobs coordina al ejecutor y sus partes. Hasta que un ejecutor recoja, el estado visible sigue «En cola · esperando al consejero». Salud de la cola no implica que Suno esté disponible o que haya alguien ejecutando. No se necesita copiar credenciales de consejeros al servidor de Studio.

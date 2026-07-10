# Roadmap ejecutivo · Demo Pixeria × Clear Channel

**Reunión:** martes 14 de julio de 2026
**Preparado por:** equipo AdmiraNeXT (Pixeria)
**Ámbito:** audio con IA (hilo musical + megafonía) y contenidos automáticos y segmentados sobre el motor de Pixeria.
**Página de la demo:** `/clearchannel/` (interna, `noindex` — material de reunión, no público).

---

## 1. Qué se demuestra el martes

Tres capacidades, todas navegables en la misma página `/clearchannel/`:

| # | Capacidad | Qué ve Clear Channel | Estado en la demo |
|---|-----------|----------------------|-------------------|
| A | **Hilo musical (Suno)** | 3 pistas de ambiente por marca/franja (retail mañana, flagship tarde, premium noche) con su prompt | Audio **placeholder** local; integración lista para clave |
| B | **Megafonía (ElevenLabs)** | Compositor "escribe el aviso → emitir" + 5 avisos tipo (apertura, cierre, promo, seguridad, EN) | Voz **placeholder** local (macOS TTS); producción vía worker proxy |
| C | **Contenidos automáticos y segmentados** | Una campaña base renderizada en vivo para N pantallas por audiencia × franja × ubicación | Motor de render **real** en la página |

**Mensaje de la reunión:** Pixeria no es una demo de herramientas sueltas — es un motor que ya orquesta imagen, vídeo y audio a pantallas (Pixer Feed). Estas tres piezas encajan en ese motor. Lo que falta para producción con Clear Channel es conectar inventario real, claves y el proxy de voz; nada de esto es investigación, es integración.

---

## 2. Arquitectura por capacidad

### A) Hilo musical — Suno
```
Brief de marca (tono, tempo, referencias)
      → Prompt a la API de Suno (por ambiente/franja)
      → Cola de generación (async)
      → Curación humana (aprobar / descartar / re-generar)
      → Publicación al reproductor de zona vía Pixer Feed
      → Rotación renovable, sin repetición, trazada
```
- **Real hoy:** el patrón de prompt→cola→curación→publicación ya existe en el Studio de Pixeria para otros formatos. Reaprovechable 1:1 para música.
- **Falta para producción:** clave `SUNO_API_KEY` en la bóveda; conector de la API de Suno; almacenamiento de pistas aprobadas (R2); binding al reproductor de cada pantalla/zona.

### B) Megafonía — ElevenLabs
```
Texto del aviso (central o tienda)
      → Worker proxy Cloudflare (la clave vive en la bóveda, NUNCA en el navegador)
      → ElevenLabs TTS (voz de marca, ES/EN)
      → MP3 en cola de megafonía por zona
      → Altavoces / pantalla con audio
```
- **Por qué proxy:** una clave de TTS en el front es una fuga inmediata. La generación se hace server-side; el navegador solo pide "genera este texto con esta voz" y recibe el MP3.
- **Real hoy:** avisos pregrabados de ejemplo; el flujo de compositor está montado en la UI.
- **Falta para producción:** clave `ELEVENLABS_API_KEY`; worker proxy (~1 endpoint); definición de voz de marca (voice ID); enrutado a zonas de megafonía.

### C) Motor de segmentación
```
Campaña base (modelo editorial: titular, oferta, tono, CTA)
      × Matriz de segmentos (audiencia × franja × ubicación/soporte)
      → Render automático de 1 variante por combinación
      → Salida a cada pantalla del inventario vía Pixer Feed
```
- **Real hoy (en la propia página):** el motor genera y pinta cada creatividad en vivo desde un modelo de campaña + una matriz de segmentos. Es la misma lógica que vive en el Studio `/crear/` (223 KB de app real).
- **Falta para producción:** conectar el **inventario real de soportes** de Clear Channel (ubicaciones, formatos, resoluciones) y el **calendario de emisión**; render a plantillas de marca definitivas.

---

## 3. Derechos de uso comercial (investigado, con fuentes)

> Honestidad total: esto condiciona si el hilo musical se puede usar legalmente en espacios públicos. Resumen de lo confirmado por búsqueda en julio de 2026.

### Suno (hilo musical)
- Los planes **de pago (Pro ~10 $/mes, Premier ~30 $/mes)** otorgan **derechos de uso comercial** de las canciones generadas, y **se conservan aunque canceles** la suscripción. Fuente oficial: [Suno — "Does Suno own the music I make?"](https://help.suno.com/en/articles/2416769).
- El plan **gratuito NO permite uso comercial**: las pistas son solo para uso no comercial. (misma fuente)
- **Matiz importante (no ocultar):** "uso comercial" **no equivale a titularidad de copyright**. Análisis legales señalan que el usuario recibe derechos de reproducción/distribución pero **generalmente no se le considera propietario** de la obra (generada por IA), y **no hay exclusividad** (otro podría generar algo similar). Fuentes: [Terms.Law — Suno commercial rights](https://terms.law/ai-output-rights/suno/), [Suno commercial use guide 2026 — TechJack](https://techjacksolutions.com/ai-tools/suno/suno-commercial-use/).
- **Implicación para retail/espacios públicos:** con plan de pago se puede usar como música de fondo en tienda, pero conviene revisar los Términos vigentes antes de un despliegue masivo y no asumir exclusividad de marca sobre las pistas.
- **Pendiente de confirmar con Suno directamente** para un caso Clear Channel: si su licencia comercial cubre **difusión pública** (public performance) en cientos/miles de locales, o si haría falta un acuerdo específico/licencia de nivel empresarial. **No lo damos por cerrado.**

### ElevenLabs (megafonía)
- La **licencia comercial** comienza en el tier **Starter (~6 $/mes, 30.000 créditos/mes)**; el plan gratuito **no** incluye derechos comerciales. Fuente: [ElevenLabs Pricing](https://elevenlabs.io/pricing).
- Tiers superiores: **Creator ~11 $/mes** (121.000 créditos), **Pro 99 $/mes** (600.000), **Scale 299 $/mes** (1,8 M), **Business 990 $/mes** (6 M). (misma fuente)
- Coste API de referencia: en torno a **0,10 $ / 1.000 caracteres** (Multilingual v2/v3) o **0,05 $** (Flash/Turbo). Fuente: [BIGVU — ElevenLabs pricing 2026](https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/).
- **Matices a revisar:** clonación de voz, redistribución y **divulgación de voz sintética** varían por caso de uso; para una voz de marca conviene el tier con Professional Voice Cloning (Creator+).

---

## 4. Costes estimados por tienda / mes

> Estimación de orden de magnitud para dimensionar, **no** presupuesto cerrado. Precios de lista confirmados arriba; el volumen es una hipótesis de trabajo.

**Supuestos por tienda:** ~30 avisos de megafonía/día (~120 caracteres cada uno) y hilo musical renovado mensualmente.

| Partida | Base de cálculo | Coste orientativo |
|---------|-----------------|-------------------|
| **Megafonía (ElevenLabs)** | 30 avisos/día × 120 car. × 30 días ≈ 108.000 car./mes × 0,10 $/1k | **~11 $/tienda/mes** en consumo TTS |
| **Hilo musical (Suno)** | Cuota de plan (Pro/Premier) compartida entre catálogo de pistas, no por tienda | **~10–30 $/mes por cuenta**, prorrateado (céntimos/tienda a escala) |
| **Infra (worker proxy + R2 + Pixer Feed)** | Cloudflare Workers/R2, tráfico de audio | **marginal** (< 1 $/tienda/mes a escala) |
| **Total variable estimado** | — | **~11–15 $/tienda/mes** dominado por la megafonía |

A escala (cientos de tiendas) el coste por tienda **baja** porque la cuota de Suno y la infra se prorratean. El driver de coste real es el **volumen de caracteres de megafonía**; se controla con plantillas y límites.

---

## 5. Qué es real hoy vs qué falta

| Pieza | Real hoy | Falta para producción |
|-------|----------|-----------------------|
| Hilo musical | Patrón prompt→cola→curación (Studio); UI de reproductores | Clave Suno · conector API · almacenamiento R2 · binding a zonas |
| Megafonía | Compositor UI · avisos ejemplo · flujo definido | Clave ElevenLabs · worker proxy · voice ID de marca · enrutado a zonas |
| Segmentación | **Motor de render en vivo** (esta página) · Studio /crear/ (223 KB) | Inventario real de soportes · calendario de emisión · plantillas finales |
| Pixer Feed | Empuje de contenido a pantallas (ya en operación) | Integración con inventario Clear Channel |

---

## 6. Plan de 3 fases post-reunión

**Fase 1 — Piloto técnico (2–3 semanas).**
Claves Suno + ElevenLabs en la bóveda. Worker proxy de voz. Conector Suno con curación. Piloto en 3–5 pantallas reales de Clear Channel con una campaña segmentada de verdad. Objetivo: audio real sonando y una campaña renderizada a inventario real.

**Fase 2 — Integración de inventario (4–6 semanas).**
Conectar el catálogo de soportes de Clear Channel (ubicaciones, formatos, resoluciones) y el calendario de emisión. Definir voz de marca (voice ID) y las plantillas visuales definitivas por soporte. Cerrar con Suno los términos de difusión pública a escala. Objetivo: parrilla operativa multi-ciudad.

**Fase 3 — Escala y operación (continuo).**
Despliegue a la red, panel de control por central/tienda, límites de coste, trazabilidad de derechos por pista, métricas de emisión. Objetivo: operación autónoma con supervisión humana y coste por tienda controlado.

---

## 7. Riesgos y plan B para la demo en vivo

- **Sin conexión a `carlossilva.info`** (design tokens externos): la página degrada con el `styles.css` local — estructura y colores base se mantienen. Plan B: servir con red o aceptar la nav sin los tokens externos.
- **Autoplay de audio bloqueado por el navegador:** todos los reproductores requieren un click manual (no hay autoplay). El botón "Emitir" hace `play()` tras interacción del usuario; si el navegador lo bloquea, el texto indica pulsar play manualmente.
- **Confusión demo vs real:** cada bloque lleva una etiqueta explícita de estado (placeholder / real). No se presenta nada simulado como si fuera producción.

---

*Documento interno de trabajo. Los precios de lista están confirmados por las fuentes citadas (julio 2026); los volúmenes son hipótesis para dimensionar. Los términos de difusión pública de Suno para una red de retail quedan pendientes de confirmación directa con el proveedor.*

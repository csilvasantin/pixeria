# Admirito Creativo · comandos y combos de diez segundos

`/admirito creativo help` muestra todos los comandos en el asistente y en el log de Experto. Pulsar una sugerencia la coloca en el compositor para aceptarla con Enter o ↑. La ayuda no genera, no importa ni publica.

## Crear un combo

- `/crear combo imagen locucion 10 segundos`
- `/crear combo imagen musica 10 segundos`

Los dos comandos abren **Detalle del combo**, dentro del entorno del Creativo. Completa **Describe la imagen** y **Texto literal a locutar** o **Letra literal de la canción**. Elige chico/chica, ESP/ENG (ambos en música), estilo musical y horizontal/vertical. **Revisar combo** guarda el encargo; **Crear combo** solicita los componentes que falten y prepara un MP4 de diez segundos. El coste visible identifica Grok Imagine Image Pro y ElevenLabs o la cuenta Suno del consejero. No hay estimación de precio inventada.

El compositor del asistente también acepta campos literales explícitos:

```text
/crear combo imagen locucion 10 segundos imagen "Una taza de café en una mesa luminosa" texto "Bienvenido. Tu café está listo." chica esp horizontal
/crear combo imagen musica 10 segundos imagen "Una cafetería al amanecer" letra "Empieza el día, despierta el sol" chico esp funk horizontal
```

Las comillas internas y saltos de línea de estas órdenes se escriben como cadenas JSON (`\"`, `\n`). Para escribir libremente, usa los campos de Detalle; conservan el texto literal y sus saltos. El enlace MCP conserva los campos en el fragmento del navegador, sin enviarlos en la consulta al servidor.

## Duración y recuperación

La imagen se mantiene durante diez segundos, sin recortarla. El vídeo final es 1920 × 1080 o 1080 × 1920, H.264/AAC a 25 fps.

- Una locución corta se completa con silencio. Si supera diez segundos, el montaje se bloquea y pide acortar el texto: no corta palabras ni acelera la voz. La imagen y la locución originales siguen guardadas.
- La canción se solicita exclusivamente a los consejeros/Suno, con `duration_seconds:10` como indicación. La duración real depende del resultado de Suno. Si dura más, se conserva completa y se pide escuchar y seleccionar el inicio del fragmento de diez segundos antes de montar.
- Imagen y audio tienen reclamaciones atómicas independientes. Al recargar se consultan sus estados; los envíos inciertos no se repiten. Cambiar el texto conservando descripción y formato de imagen reutiliza los píxeles ya guardados. Un fallo local de montaje no repite los proveedores.
- **Guardar en Stock** requiere una acción posterior, tras revisar. No distribuye ni programa pantallas. La recuperación local pertenece a este navegador y origen.

La cola musical acepta el encargo aunque ningún consejero esté disponible. Un estado **en cola** no acredita una canción generada. No hay un navegador Suno nuevo en el Creativo y no se usa el MCP Lyria como sustituto.

## MCP para agentes y consejeros

Servidor existente de Studio/Pixeria: `https://mcp-pixeria.admira.store/mcp` (Streamable HTTP).

- `creativo_help {"language":"es"}` devuelve el catálogo completo, los límites y enlaces.
- `creativo_combo_preparar` valida los campos, devuelve un contrato estable y el enlace para revisarlo en el Creativo. Es una herramienta de **preparación**, no ejecuta proveedores, no renderiza ni publica Stock. No necesita una clave nueva. La generación se confirma con la sesión existente de Studio, en **Crear combo**.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "creativo_combo_preparar",
    "arguments": {
      "kind": "locucion",
      "seconds": 10,
      "imagePrompt": "Una taza de café en una mesa luminosa",
      "audioText": "Bienvenido. Tu café está listo.",
      "voice": "chica",
      "languages": ["ESP"],
      "orientation": "horizontal",
      "language": "es"
    }
  }
}
```

Para música cambia `kind` a `musica`, `audioText` por la letra literal y añade `style`, por ejemplo `funk`. No vuelvas a solicitar una canción mientras su referencia siga pendiente o incierta. Para controlar la producción musical se mantiene la cola autenticada y el protocolo de partes de [los consejeros](creativo-musica.md).

## EN

`/admirito creativo help` lists all commands. Both `/crear combo imagen locucion 10 segundos` and `/crear combo imagen musica 10 segundos` open separate image-description and exact text/lyrics fields inside Creative. Review saves; Create starts missing components. Image and audio are independently persisted. Long speech blocks export; short speech is padded with silence. Music uses counselors/Suno only and requires excerpt review when longer than ten seconds. Stock publication remains explicit.

MCP `creativo_help` and `creativo_combo_preparar` expose the same catalogue and validated review contract. They do not generate, render, publish or grant browser access. Use `language:"en"` for English instructions; voice/content languages remain the explicit `ESP`/`ENG` fields.

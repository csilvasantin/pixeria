# Players nativos · Native players

Pixeria v.12.10.2026.r1.16:22 · Hoy #148 · Trinity · MBP14.

## Español

Entra con la sesión existente y abre Modo Experto (⌘). En Creador o Adaptador selecciona el proyecto real. En Help/MCP o páginas sin selector puedes añadir `?project=starbucks` con tu identificador. El selector activo tiene prioridad. No uses `general`: sin proyecto o sin playlist asociada se devuelve un error, sin adoptar contenido global.

| Comando | Resultado |
| --- | --- |
| `/demo android` | Fold y visor Wear OS |
| `/demo android Fold8` | Sólo Fold |
| `/demo android watch` | Sólo visor Wear OS |
| `/demo ios` | iPhone y Apple Watch |
| `/demo ios iphone` / `/demo ios watch` | Destino iOS individual |

Sin selector usa la última playlist asociada al proyecto. `/demo android Fold8 playlist "Starbucks Audio"` pide una lista por nombre. `/demo android watch #retail #audio` pide las etiquetas indicadas. iOS y Android comparten el resolvedor de asociaciones; usan una copia de la selección al ejecutar, no una suscripción permanente a futuras ediciones.

Necesitas Admira Native Demo instalado en el Mac de presentación, acceso a las playlists y los runtimes disponibles. Android abre el panel en segundo plano: [ambos](http://127.0.0.1:18766/?device=both&mode=demo), [Fold](http://127.0.0.1:18766/?device=fold&mode=demo), [Watch](http://127.0.0.1:18766/?device=wear&mode=demo). Los enlaces se refieren al Mac local. Confirma el resultado en el panel: enviar la solicitud o aceptar el esquema no demuestra arranque. Si el segundo destino falla, el primero puede haber cambiado.

Fold8 es un alias del perfil virtual Pixel Fold con Android 16. No es firmware Samsung ni certificación de un Fold8 físico. El visor Wear OS 4 reproduce imágenes/vídeos sin audio; las pistas de audio muestran el título y ♫. Límite de medios Wear: 8 MiB por archivo y 24 MiB de caché total; una lista puede exceder ese presupuesto. Las apps demo tienen paquetes separados: no modifican los enlaces privados del visor ni los players físicos. No se acredita sincronía exacta, reproducción offline ni hardware físico. Home, bloqueo y cierre manual siguen permitidos.

Los comandos son acciones de Modo Experto/puente local, no herramientas MCP nuevas. El servidor existente y `tools/list` conservan sus 24 herramientas. `resources/list` descubre la guía y `resources/read {"uri":"pixeria://native-players"}` la devuelve con la autenticación de flota existente (Authorization: Bearer o X-Fleet-Key); URI exacta, sólo lectura, sin abrir dispositivos. Help y MCP muestran esta misma guía, sin exponer claves.

## English

Sign in using the existing session and open Expert mode (⌘). Select the real project in Creator/Adapter. On pages without a selector, use `?project=starbucks` with your project identifier. The active selector takes precedence. Missing project/playlist associations fail explicitly; no global playlist is substituted.

The commands in the table target both Android virtual devices, Fold only, Wear OS only, both iOS devices, or an individual iOS device. No selector means the latest associated project playlist. Add `playlist "Starbucks Audio"` for a name or `#retail #audio` for tags. Both platforms share the project association resolver and import a snapshot, not a subscription to later edits.

Requires the installed Admira Native Demo Mac bridge, playlist access and available runtimes. Android opens the local panel in the background; verify startup there. Request acceptance is not startup evidence. A second-target failure can leave the first updated. Panel links refer to the presentation Mac.

Fold8 is a Pixel Fold Android 16 virtual-profile alias, not Samsung firmware or physical Fold8 certification. Wear OS 4 previews silent images/video; audio shows the title and ♫. Wear budgets are 8 MiB per file and 24 MiB total cache. Isolated demo packages preserve private viewer links and physical players. Exact synchronization, offline playback and physical hardware are not verified. Manual Home, lock and close remain available. These are local Expert/bridge actions, not new MCP RPC tools; the existing live `tools/list` contract remains authoritative (24 tools). Authenticated `resources/list` discovers the guide; `resources/read {"uri":"pixeria://native-players"}` returns it using the existing fleet key (Authorization: Bearer or X-Fleet-Key). Exact URI only; read-only and no device launch.

## Tutorial verificado · Verified tutorial

[Animación explicativa de los cinco pilares / Five-pillar explanatory animation](https://api.yokup.com/media/fleet/dddb19c869cc0feb.mp4). 15.116 s, 1080×1920. No es una grabación real / not a real screen recording.

SHA-256: `2ad8e76ef4d3bedcbf8e1a44ecd4fdb1cbd04d60deb464f4a9aac38d9e34f9b0`.

Provenance: same vendored shared engine/modules as Android `cf5feb5`, based on canonical admira-next-web `fcec339c7d1d0b48426a43c01780e88d4c712a85`; only the existing loader is redirected locally. No shared CDN deployment.

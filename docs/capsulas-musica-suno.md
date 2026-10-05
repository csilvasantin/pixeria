# Cápsulas musicales · Suno en Música (Pixeria → admira.studio)

Fecha: 2026-10-05 (Europe/Madrid) · Agente: Huang · Fase 1

## Objetivo (Carlos)
1. 4º motor **Suno** junto a Pixer Loop / Gemini / Pixeria Music (en studio: Admira Studio Music vía `marca.json`).
2. Formulario espejo de suno.com: Songs/Speech/Sounds · Simple/Advanced · versión (v6) · +Audio/+Voice/+Image · prompt · Create.
3. Al Create: agente (box browser) con sesión **csilva@admira.com** en Suno → generar → poll → feedback + imagen + vídeo a **Stock**.

## Cómo está cableado hoy (investigación)
| Capa | Qué hace |
|------|----------|
| `app.js` → `MOTORES.musica` | 3 radios: `pixer-loop`, `lyria-3-pro-preview`, `suno-local-v5` (UI: Pixeria Music / en studio Admira Studio Music). |
| `playMusica()` | **Los tres** motores Good/Better/Best ya redirigen a `playSunoLocal` con chirp-v4-5 / v5 / v5-5 vía proxy `suno-local` (`:3777` o Tailscale `/suno`). Lyria “Gemini” en la tarjeta no es Lyria real en ese path. |
| `playSunoLocal` | POST `/generate` + poll `/status`, portada, `publishBtnHTML` → Stock. **Gasta créditos** de la cuenta logueada en el proxy. |
| Hilo musical (Eleven) | Separado: Eleven Music v2 para playlist continua retail (docs Clear Channel). Suno API pública aún no; partners jul-2026. |
| Stock | Galería R2 + `publish` desde player; import URL vía yt-dlp / suno-local. |

## Diseño fase 1 (esta entrega)
- Nuevo motor `suno-web` (badge **Suno**, use **Cápsula**).
- Panel `#sunoCapsula` (espejo UI screenshot) visible solo con ese motor; oculta campos clásicos `#musicaClassicFields`.
- `POST /api/suno-queue` (CF Pages Function): valida payload, responde `202` con `jobId`, **`execute:false` / `dryRun:true` siempre**. Si el cliente manda `execute:true`, se bloquea con mensaje (no quemar créditos).
- Cliente guarda jobs en `localStorage` (`pixer_suno_jobs_v1`) y muestra estado en player + `#sunoJobStatus`.
- **No** se abre suno.com ni se llama al proxy suno-local desde este motor en fase 1.

## Login Suno en el box (comprobado)
- Perfiles Chrome en `/home/box/chrome-profile/{Default,Fork-2,Fork-3}`: **sin cookies ni logins con host `*suno*`**.
- No hay herramienta ListCredentials en el catálogo MCP de este agente.
- **Conclusión:** hay que hacer sign-in de `csilva@admira.com` en el browser del box (parent / Carlos) **antes de fase 2**. No intentar Create real hasta entonces.

## Fase 2 (tras confirmación de Carlos)
1. Carlos confirma un **prompt de prueba** explícito.
2. Sign-in Suno en box browser (csilva@admira.com).
3. Worker/agente: lee jobs `queued` → rellena UI Suno → Create → poll complete → descarga audio + cover + video_url.
4. Publica en Stock (mismo contrato que `publishBtnHTML` / import) con tags `suno`, `capsula`, cliente.
5. Opcional: KV/R2 para cola durable; flag `SUNO_EXECUTE=1` en function.

## Sync / PRs
- Fuente: **pixeria** PR → merge → `admira-studio/./sync.sh --aplicar` → PR studio (si hace falta) → deploy.
- **No fusionar** admira-studio PR #1 (analítica / cookies).
- Tag retorno: `retorno/pre-suno-capsulas-20261005`.

## Verificación fase 1
- [ ] 4ª tarjeta Suno en `/musica.html`
- [ ] Formulario espejo al elegir Suno
- [ ] Create → job dry-run, sin llamada a Suno / sin gasto
- [ ] Plan en `/workspace/huang/store/CAPSULAS-MUSICA-SUNO.md`


## 2026-10-05 r7
- Idiomas ESP/ENG multi-select.
- Create con execute real vía suno-local.

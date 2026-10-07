# Vista por cliente · quién ve qué en el Stock

Carlos, 7-oct-2026: «los contenidos subidos con el hashtag de un cliente no lo verán el resto de clientes». Decisión:
la asignación de cada usuario a su cliente sale de la **identidad central de AdmiraNeXT** y se empieza por la **vista**.

## Qué hace

- Una pieza es de un cliente si lleva su etiqueta (`#starbucks`), su catálogo, o el nombre único de uno de sus centros o
  pantallas (`#starbucks_paseodegracia_103_pantalla1`: empieza por el proyecto). Lo que no es de ningún cliente es genérico.
- Una cuenta **asignada a un cliente** ve lo de ese cliente y lo genérico. No ve lo de otros clientes ni lo ambiguo
  (piezas de dos clientes a la vez).
- No puede salir de ahí: `/marca off`, `/marca todas`, `?cliente=` y el flag local `pixeria:admin` no la mueven.
  Con varios clientes asignados elige entre los suyos (selector junto al logo o `/marca <cliente>`).
- Una cuenta sin restricción (superusuario, administrador, equipo sin cliente asignado) sigue como siempre: Admira lo ve
  todo y el superusuario cambia de cliente con `/marca`.

## De dónde sale la asignación

`GET /auth/session` devuelve `clientes`: `null` (sin restricción) o la lista de ids. La calcula `clientesPermitidos`
(`functions/_auth.js`) leyendo la identidad central, que vive en la misma base de datos (`AUTH_DB`):

| En `www.admiranext.com/usuarios` | En pixeria |
|---|---|
| Administrador, «Todos» (`*`) o «todos los proyectos comerciales» | sin restricción |
| Uno o varios «Proyecto comercial» (`commercial:<id>`) | sólo esos clientes |
| Equipo sin proyecto comercial | sin restricción (como hasta ahora) |
| Invitado o partner sin proyecto comercial | sólo lo genérico |
| No está en el directorio central | sin restricción (como hasta ahora) |

Para asignar un usuario a un cliente: `www.admiranext.com/usuarios` → su fila → «Proyecto comercial contratado» →
Guardar. Tarda hasta un minuto en aplicarse (caché por instancia).

## Dónde se aplica

`assets/cliente-activo.js` (`PixeriaCliente.restringido()`, `permitidos()`, `visible(it)`, `filtrar(lista)`):
- `stock.html` y `en/stock.html`: se filtra **en origen** (`soloMio`), así ninguna vista de la página —rejilla, Catálogos,
  nube de etiquetas, contadores, enlace directo— enseña lo ajeno.
- Selector de Stock del Adaptador (`adaptaciones/stock-select.js`) y los listados de `crear/` (muebles, últimos por tipo).

## Límites (es una vista, no una barrera)

- El índice del Stock (`stock.admira.store/stock/index.json`), cada `meta.json` y los ficheros son **públicos por
  dirección**: quien tenga el enlace de una pieza la abre. Cerrarlo exige filtrar en el servidor y afecta a los players.
- La primera página de una sesión puede pintar un instante antes de saber que la cuenta está asignada; desde entonces se
  recuerda en la pestaña y no se pinta nada hasta saberlo.
- Sin filtrar todavía: los inventarios de Xpacios (`assets/xpaces/capsulas.mjs`, `assets/furniture/catalog.mjs`), la
  biblioteca de proyectos del Adaptador y `functions/players-programar.js`.
- Si la base de datos no responde no se inventa una restricción: se conserva lo último sabido.

Pruebas: `node --test test/cliente-activo.test.mjs test/auth-flow.test.mjs`.

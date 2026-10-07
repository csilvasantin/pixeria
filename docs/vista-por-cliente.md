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

## Grupos: Alsea = Starbucks

Carlos, 7-oct-2026: «Alsea es la propietaria de la marca Starbucks en España y México: son lo mismo». Alsea no es un
cliente aparte sino un **grupo** (`data/clientes-mapeo.json` → `grupos.alsea.miembros = [starbucks, starbucks-mexico]`):

- Lo marcado sólo con Alsea (etiqueta `#alsea`, catálogo de Alsea, «Alsea» en el título) lo ven las cuentas de
  Starbucks y las de Starbucks México.
- Si la pieza lleva además un cliente concreto, manda el cliente: `#starbucks #alsea` es de Starbucks (ya no es
  ambigua) y una cuenta de Starbucks México no la ve.
- Otro cliente no ve nada de Alsea. En la ficha técnica sale «Alsea · Starbucks y Starbucks México».

Para declarar otro grupo basta añadirlo en `grupos` con sus `miembros`, `tags` y `patrones`.

## Ver como · comprobar la vista de un cliente

Carlos, 7-oct-2026. El superusuario puede ver la web **exactamente** como una cuenta asignada a un cliente, sin tocar
los permisos de nadie:

- `/marca ver-como starbucks` en ⌘ Experto: la página se recarga y queda bloqueada como una cuenta de Starbucks (su
  contenido y el genérico; ni `/marca`, ni `?cliente=` la sacan de ahí). Junto al logo aparece «Viendo como: Starbucks».
- Dura toda la pestaña, en cualquier página. `/marca ver-como off` sale y vuelve a verlo todo.
- Sólo restringe, nunca amplía; sólo vale con sesión de superusuario (lo dice el servidor) y sólo en esa pestaña.

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

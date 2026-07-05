# discord-spam-bot

Bot de Discord que corre en una Raspberry Pi (o cualquier host **sin IP pública ni puertos abiertos**) y detecta cuando un mismo usuario manda el **mismo contenido en más de un canal dentro de 5 segundos**. Al detectarlo, le asigna un rol **"Silenciado"** y **borra los mensajes del brote**.

Funciona detrás de NAT porque un bot de Discord se conecta por el **Gateway (WebSocket saliente)**: es la Pi quien inicia la conexión hacia Discord. No usa webhooks ni endpoints HTTP entrantes.

Detecta duplicados por:
- **Texto**: normalizado (trim + minúsculas + espacios colapsados).
- **Imágenes**: hash perceptual (pHash) con umbral de distancia de Hamming, así que también atrapa la misma imagen recomprimida o reescalada.

## 1. Crear el bot en Discord

> Entre paréntesis dejo el nombre en inglés de cada opción por si tu portal o
> cliente cambia el idioma o alguna traducción no coincide.

1. Andá al [Portal de Desarrolladores de Discord](https://discord.com/developers/applications) → **Nueva aplicación** (*New Application*).
2. **Bot** → **Restablecer token** (*Reset Token*) y copiá el token (va en `DISCORD_TOKEN`).
3. En **Bot → Privileged Gateway Intents** (ese encabezado el portal lo deja en inglés), activá:
   - **Intent de contenido de mensajes** (*Message Content Intent*) — obligatorio para leer el texto.
   - **Intent de miembros del servidor** (*Server Members Intent*) — recomendado.
4. Invitá el bot a tu servidor con los permisos **Gestionar roles** (*Manage Roles*)
   y **Gestionar mensajes** (*Manage Messages*). Esos dos permisos dan el valor
   `268443648`. Ojo: el número que muestra el portal **no es un link**, solo el
   cálculo de permisos. Para invitarlo tenés dos formas:

   **Forma rápida** — copiá el **ID de la aplicación** (en *Información general*)
   y abrí en el navegador:
   ```
   https://discord.com/api/oauth2/authorize?client_id=1523154168838230027&permissions=268443648&scope=bot
   ```
   Elegí tu servidor y autorizá.

   **Forma con el portal** — **OAuth2 → Generador de URL** (*URL Generator*):
   marcá el scope **`bot`**, después marcá **Gestionar roles** y **Gestionar mensajes**,
   y copiá la URL que se genera al final de la página. Abrila y autorizá.

## 2. Configurar el rol "Silenciado"

- Creá (si no existe) el rol **Silenciado** y configurá sus permisos para que
  tenga **desactivado "Enviar mensajes"** (en el rol y/o en los permisos de cada canal).
- **Importante**: en **Configuración del servidor → Roles**, arrastrá el rol del
  **bot para que quede por encima** de "Silenciado"; si no, Discord no lo deja asignarlo.
- Activá el **Modo desarrollador** en **Ajustes de usuario → Avanzado**. Después,
  clic derecho sobre el rol → **Copiar ID**. Ese valor va en `MUTED_ROLE_ID`.

## 3. Configuración (.env)

Copiá `.env.example` a `.env` y completá:

```
DISCORD_TOKEN=tu_token
MUTED_ROLE_ID=id_del_rol
WINDOW_MS=5000
MIN_CHANNELS=2
IMAGE_HASH_THRESHOLD=6
```

## 4. Correr localmente (desarrollo)

```bash
npm install
npm run dev
```

Deberías ver `Conectado como <nombre>#0000`.

## 5. Deploy en la Raspberry Pi

La imagen se publica automáticamente en **ghcr.io** al hacer push a `main` (ver
`.github/workflows/docker-publish.yml`). Es multi-arch (`amd64` + `arm64`), así
que corre en la Pi sin cambios.

En la Pi:

1. Editá `docker-compose.yml` y reemplazá `<owner>` por tu usuario/organización de GitHub **en minúsculas**.
2. Creá el archivo `.env` (mismo formato que arriba).
3. Si el paquete es privado, autenticá Docker contra ghcr.io con un
   [Personal Access Token](https://github.com/settings/tokens) con scope `read:packages`:
   ```bash
   echo "TU_PAT" | docker login ghcr.io -u TU_USUARIO --password-stdin
   ```
   (Si hacés el paquete público en GitHub → Packages, este paso no hace falta.)
4. Levantá el bot:
   ```bash
   docker compose pull
   docker compose up -d
   docker compose logs -f
   ```

Para actualizar a una versión nueva: `docker compose pull && docker compose up -d`.

## 6. Cómo funciona la detección

- Cada mensaje entrante se guarda en una ventana en memoria de `WINDOW_MS` ms.
- Si el **mismo usuario** repite el mismo contenido (texto o imagen similar) en
  **≥ `MIN_CHANNELS`** canales distintos dentro de la ventana, se dispara un
  "brote": se asigna el rol "Silenciado" y se borran todos los mensajes del brote.
- Todo el estado es en memoria (no hay base de datos), ideal para la Pi. Al
  reiniciar el bot, la ventana se vacía.

## Estructura

```
src/
  index.ts       # entrypoint: client, eventos, login
  config.ts      # lee/valida variables de entorno
  detector.ts    # ventana deslizante + dedup cross-canal
  imageHash.ts   # pHash de imágenes + distancia de Hamming
  moderation.ts  # asigna rol + borra mensajes
```

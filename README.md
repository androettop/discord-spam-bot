# discord-spam-bot

Bot de Discord que corre en una Raspberry Pi (o cualquier host **sin IP pública ni puertos abiertos**) y detecta cuando un mismo usuario manda el **mismo contenido en más de un canal dentro de 5 segundos**. Al detectarlo, le asigna un rol **"Silenciado"** y **borra los mensajes del brote**.

Funciona detrás de NAT porque un bot de Discord se conecta por el **Gateway (WebSocket saliente)**: es la Pi quien inicia la conexión hacia Discord. No usa webhooks ni endpoints HTTP entrantes.

Detecta duplicados por:
- **Texto**: normalizado (trim + minúsculas + espacios colapsados).
- **Imágenes**: hash perceptual (pHash) con umbral de distancia de Hamming, así que también atrapa la misma imagen recomprimida o reescalada.

## 1. Crear el bot en Discord

1. Andá al [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** → **Reset Token** y copiá el token (va en `DISCORD_TOKEN`).
3. En **Bot → Privileged Gateway Intents**, activá:
   - **MESSAGE CONTENT INTENT** (obligatorio para leer el texto).
   - **SERVER MEMBERS INTENT** (recomendado).
4. Invitá el bot con permisos **Manage Roles** y **Manage Messages**. Podés usar
   **OAuth2 → URL Generator** con scope `bot` y esos dos permisos.

## 2. Configurar el rol "Silenciado"

- Creá (si no existe) el rol **Silenciado** y configurá los permisos para que **no pueda enviar mensajes** (permiso del rol y/o *overwrites* en los canales).
- **Importante**: en **Configuración del servidor → Roles**, el rol del **bot debe estar por encima** de "Silenciado", si no Discord no lo deja asignarlo.
- Activá **Modo Desarrollador** (Ajustes de usuario → Avanzado), clic derecho sobre el rol → **Copiar ID**. Ese valor va en `MUTED_ROLE_ID`.

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

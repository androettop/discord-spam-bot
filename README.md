# discord-spam-bot

A Discord bot that detects when the same user posts the **same content in more than one channel within 5 seconds**. When it does, the bot assigns a **"Muted" role** to the author and **deletes the messages from the burst**.

Duplicate detection works on:
- **Text**: normalized (trim + lowercase + collapsed whitespace).
- **Images**: perceptual hash (pHash) with a Hamming-distance threshold, so it also catches the same image after recompression or slight resizing.

All state is kept **in memory** (no database). Restarting the bot clears the detection window.

## 1. Create the bot on Discord

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** → **Reset Token** and copy the token (goes into `DISCORD_TOKEN`).
3. Under **Bot → Privileged Gateway Intents**, enable:
   - **Message Content Intent** — required to read message text.
   - **Server Members Intent** — recommended.
4. Invite the bot with the **Manage Roles** and **Manage Messages** permissions.
   Those two permissions produce the value `268443648`. Note the number the portal
   shows is **not a link**, just the permission calculation. To invite the bot,
   copy your **Application ID** (under *General Information*) and open:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_APP_ID&permissions=268443648&scope=bot
   ```
   Pick your server and authorize. (Alternatively, use **OAuth2 → URL Generator**
   with the `bot` scope and those two permissions.)

## 2. Configure the "Muted" role

- Create a **Muted** role and set its channel permissions so that **"Send Messages"
  is denied** (the red ✗) at the channel or category level. A role's own permission
  toggles are additive and won't override what `@everyone` already allows — the deny
  must be set as a channel/category permission overwrite.
- **Important**: in **Server Settings → Roles**, drag the **bot's role above** the
  "Muted" role; otherwise Discord won't let the bot assign it.
- Enable **Developer Mode** (User Settings → Advanced), then right-click the role →
  **Copy ID**. That value goes into `MUTED_ROLE_ID`.

The bot also needs **Manage Messages** effective in the channels it moderates in
order to delete messages.

## 3. Configuration (.env)

Copy `.env.example` to `.env` and fill it in:

```
DISCORD_TOKEN=your_token
MUTED_ROLE_ID=role_id
WINDOW_MS=5000
MIN_CHANNELS=2
IMAGE_HASH_THRESHOLD=6
```

- `WINDOW_MS` — detection window in milliseconds.
- `MIN_CHANNELS` — minimum number of distinct channels to count as spam.
- `IMAGE_HASH_THRESHOLD` — max Hamming distance (0–64) for two images to be
  considered equal. Higher = more tolerant.

## 4. Run locally

```bash
npm install
npm run dev
```

You should see `Connected as <name>#0000`.

## 5. Deploy with Docker

The image is published to **ghcr.io** automatically on push to `main` (see
`.github/workflows/docker-publish.yml`). It's multi-arch (`amd64` + `arm64`).

1. Edit `docker-compose.yml` and set your GitHub owner (lowercase) in the image name.
2. Create the `.env` file (same format as above).
3. If the package is private, authenticate Docker against ghcr.io with a
   [Personal Access Token](https://github.com/settings/tokens) with the `read:packages` scope:
   ```bash
   echo "YOUR_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
   ```
   (If you make the package public under GitHub → Packages, this step isn't needed.)
4. Start the bot:
   ```bash
   docker compose pull
   docker compose up -d
   docker compose logs -f
   ```

To update to a new version: `docker compose pull && docker compose up -d`.

## 6. How detection works

- Each incoming message is recorded in an in-memory window of `WINDOW_MS` ms.
- If the **same user** repeats the same content (text or a perceptually similar
  image) across **≥ `MIN_CHANNELS`** distinct channels within the window, a "burst"
  is triggered: the "Muted" role is assigned and all messages in the burst are deleted.

## Structure

```
src/
  index.ts       # entrypoint: client, events, login
  config.ts      # reads/validates environment variables
  detector.ts    # sliding window + cross-channel dedup
  imageHash.ts   # image pHash + Hamming distance
  moderation.ts  # assigns role + deletes messages
```

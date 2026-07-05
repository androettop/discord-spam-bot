function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`[config] Falta la variable de entorno obligatoria: ${name}`);
    process.exit(1);
  }
  return value.trim();
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.error(`[config] ${name} no es un número válido: "${raw}"`);
    process.exit(1);
  }
  return parsed;
}

export const config = {
  /** Token del bot de Discord. */
  token: required("DISCORD_TOKEN"),
  /** ID del rol "Silenciado" ya existente en el servidor. */
  mutedRoleId: required("MUTED_ROLE_ID"),
  /** Ventana de detección en milisegundos. */
  windowMs: num("WINDOW_MS", 5000),
  /** Cantidad mínima de canales distintos para considerar spam. */
  minChannels: num("MIN_CHANNELS", 2),
  /** Distancia de Hamming máxima entre pHashes para considerar dos imágenes iguales (0-64). */
  imageHashThreshold: num("IMAGE_HASH_THRESHOLD", 6),
} as const;

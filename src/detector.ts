import { hammingDistance } from "./imageHash.js";

export type MsgRecord = {
  userId: string;
  channelId: string;
  messageId: string;
  guildId: string;
  ts: number;
  /** Texto normalizado ('' si el mensaje no tiene texto). */
  normText: string;
  /** pHashes de los adjuntos que son imágenes. */
  imageHashes: string[];
};

export type DetectorOptions = {
  windowMs: number;
  minChannels: number;
  imageHashThreshold: number;
};

/** Normaliza el texto: trim, minúsculas y colapsa espacios múltiples. */
export function normalizeText(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Detector de spam cross-canal en memoria.
 *
 * Mantiene una ventana deslizante de los mensajes recientes por usuario y
 * determina si un mensaje nuevo forma un "brote": el mismo contenido (texto
 * normalizado o imagen perceptualmente similar) enviado por el mismo usuario
 * en >= minChannels canales distintos dentro de windowMs.
 */
export class SpamDetector {
  private records: MsgRecord[] = [];
  /** IDs de mensajes ya consumidos por un brote, para no re-procesarlos. */
  private consumed = new Set<string>();

  constructor(private readonly opts: DetectorOptions) {}

  private prune(now: number): void {
    const cutoff = now - this.opts.windowMs;
    this.records = this.records.filter((r) => r.ts >= cutoff);
    // Evitar que `consumed` crezca sin límite: al podar, sólo conservamos
    // los IDs que todavía están en la ventana.
    if (this.consumed.size > 0) {
      const live = new Set(this.records.map((r) => r.messageId));
      for (const id of this.consumed) {
        if (!live.has(id)) this.consumed.delete(id);
      }
    }
  }

  /** ¿El contenido de dos registros coincide (texto o imagen)? */
  private matches(a: MsgRecord, b: MsgRecord): boolean {
    if (a.normText !== "" && a.normText === b.normText) return true;
    for (const ha of a.imageHashes) {
      for (const hb of b.imageHashes) {
        if (hammingDistance(ha, hb) <= this.opts.imageHashThreshold) return true;
      }
    }
    return false;
  }

  /**
   * Registra el mensaje y devuelve el brote detectado (incluye el mensaje
   * nuevo) si dispara la condición de spam, o null en caso contrario.
   */
  check(record: MsgRecord): MsgRecord[] | null {
    this.prune(record.ts);

    // Registros previos del mismo usuario que coinciden en contenido.
    // Incluye los ya consumidos: si un mensaje que llega tarde continúa un
    // brote en curso (mismo contenido en otro canal), también hay que borrarlo.
    const matched = this.records.filter(
      (r) => r.userId === record.userId && this.matches(r, record),
    );

    // El mensaje nuevo siempre se agrega al historial para futuros matches.
    this.records.push(record);

    const group = [...matched, record];
    const distinctChannels = new Set(group.map((r) => r.channelId));

    if (distinctChannels.size >= this.opts.minChannels) {
      // Es un brote. Sólo devolvemos (y marcamos) los mensajes que todavía
      // no fueron moderados, para no re-borrar los que ya se procesaron.
      const fresh = group.filter((r) => !this.consumed.has(r.messageId));
      for (const r of fresh) this.consumed.add(r.messageId);
      return fresh.length > 0 ? fresh : null;
    }

    return null;
  }
}

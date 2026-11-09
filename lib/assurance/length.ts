// Length constraints (Deterministic vs reasoning tab, §6).
// Only the platform byte cap blocks; the band is a coaching signal.

/**
 * Google Business Profile API: reply comment maximum is 4096 bytes.
 * https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
 */
export const GOOGLE_REPLY_MAX_BYTES = 4096;

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Languages written without spaces between words: count characters instead. */
const CHARACTER_COUNTED = ["zh", "ja"];

export function lengthUnits(text: string, languageTag: string): { unit: "words" | "chars"; count: number } {
  const primary = languageTag.toLowerCase().split("-")[0];
  if (CHARACTER_COUNTED.includes(primary)) {
    return { unit: "chars", count: [...text.replace(/\s+/g, "")].length };
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  return { unit: "words", count: words.length };
}

export interface LengthBandParams {
  floor: number;
  ratioMin: number;
  ratioMax: number;
  ceiling: number;
  escalatedCeiling: number;
}

/**
 * PROPOSED placeholders, to be set from evidence (spec §6.5). Calibrated in
 * words; character-counted languages need their own values before use.
 */
export const PROPOSED_LENGTH_BAND: LengthBandParams = {
  floor: 15,
  ratioMin: 0.5,
  ratioMax: 1.0,
  ceiling: 150,
  escalatedCeiling: 80,
};

export type LengthBandStatus = "within" | "below_band" | "above_band";

export interface LengthBandResult {
  status: LengthBandStatus;
  unit: "words" | "chars";
  replyUnits: number;
  minUnits: number;
  maxUnits: number;
  bytes: number;
  hardCapExceeded: boolean;
}

const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);

export function checkLengthBand(
  reviewText: string,
  replyText: string,
  languageTag: string,
  escalated: boolean,
  params: LengthBandParams = PROPOSED_LENGTH_BAND,
): LengthBandResult {
  const review = lengthUnits(reviewText, languageTag);
  const reply = lengthUnits(replyText, languageTag);
  const ceiling = escalated ? params.escalatedCeiling : params.ceiling;
  const floor = Math.min(params.floor, ceiling);
  const minUnits = Math.round(clamp(params.ratioMin * review.count, floor, ceiling));
  const maxUnits = Math.round(clamp(params.ratioMax * review.count, floor, ceiling));
  const bytes = utf8Bytes(replyText);

  let status: LengthBandStatus = "within";
  if (reply.count < minUnits) status = "below_band";
  else if (reply.count > maxUnits) status = "above_band";

  return {
    status,
    unit: reply.unit,
    replyUnits: reply.count,
    minUnits,
    maxUnits,
    bytes,
    hardCapExceeded: bytes > GOOGLE_REPLY_MAX_BYTES,
  };
}

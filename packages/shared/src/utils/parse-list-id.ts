/** Parse X/Twitter list URL or numeric list ID. */
export function parseListId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/(?:twitter\.com|x\.com)\/i\/lists\/(\d+)/i);
  if (fromUrl) return fromUrl[1]!;
  if (/^\d{5,}$/.test(trimmed)) return trimmed;
  return null;
}

/** Oldest due cards first, independent of where a client stores its progress. */
export function dueCardIds(cards: Record<string, { due: number }>, now = Date.now()) {
  return Object.entries(cards)
    .filter(([, card]) => card.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

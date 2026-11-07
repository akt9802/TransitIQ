export const STOP_RANGE_METERS = 300;

export function metersBetween(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number }
): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(right.lat - left.lat);
  const dLng = rad(right.lng - left.lng);
  const lat1 = rad(left.lat);
  const lat2 = rad(right.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function placeTitle(address: string | null): string {
  const trimmed = address?.trim();
  if (!trimmed) return "this stop";
  return trimmed.split(",").slice(0, 2).join(", ");
}

export function pickupAwayMessage(): string {
  return "You are not at the pickup. Go to the pickup, then start loading.";
}

export function stopAwayMessage(place: string): string {
  return `You are not at ${place}. Go there, then continue.`;
}

export function reachedMessage(place: string): string {
  return `You reached ${place}.`;
}

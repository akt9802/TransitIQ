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

export function trackedKilometres(points: { latitude: number; longitude: number; at: number }[]) {
  let meters = 0;
  for (let index = 1; index < points.length; index += 1) {
    const gap = points[index].at - points[index - 1].at;
    if (gap <= 0 || gap > 20 * 60 * 1000) continue;
    const segment = metersBetween(
      { lat: points[index - 1].latitude, lng: points[index - 1].longitude },
      { lat: points[index].latitude, lng: points[index].longitude }
    );
    if (segment > 20000) continue;
    meters += segment;
  }
  return Math.round((meters / 1000) * 10) / 10;
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

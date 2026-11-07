const SCRIPT_ID = "google-maps-script-transitiq";

let loading: Promise<void> | null = null;

/** Loads the Maps JavaScript API once, including Places. */
export function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places && window.google.maps.Map) return Promise.resolve();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject(new Error("missing"));
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const finish = () => {
        if (window.google?.maps?.places && window.google.maps.Map) resolve();
        else reject(new Error("maps"));
      };
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (existing) {
        if (window.google?.maps?.places) finish();
        else {
          existing.addEventListener("load", finish, { once: true });
          existing.addEventListener("error", () => reject(new Error("maps")), { once: true });
        }
        return;
      }
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
      script.onload = finish;
      script.onerror = () => reject(new Error("maps"));
      document.head.appendChild(script);
    });
  }
  return loading;
}

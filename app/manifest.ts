import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TransitIQ",
    short_name: "TransitIQ",
    description: "Live tracking, trips, fuel, and road safety for the fleet.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#2a5cda",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

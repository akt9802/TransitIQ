type Props = { className?: string; decorative?: boolean; title?: string };

/**
 * Simple truck mark for TransitIQ — vector, no external asset host.
 */
export default function TruckLogo({
  className = "h-8 w-8 text-ink",
  decorative = true,
  title = "Truck",
}: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative ? true : undefined}
      role={decorative ? "presentation" : "img"}
    >
      {!decorative ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M4 20v4h3v-2h6v2h8v-2h3v2h4v-4l-3-6H17l-1-4H4v6Zm3-4V10h8v6H7Zm11 0v-4h5.2L26 16h-8Z"
      />
      <circle cx="10" cy="25" r="2" fill="currentColor" />
      <circle cx="22" cy="25" r="2" fill="currentColor" />
    </svg>
  );
}

export type OtpPurpose = "signup" | "reset";

export function parseOtpPurpose(value: unknown): OtpPurpose {
  return value === "reset" ? "reset" : "signup";
}

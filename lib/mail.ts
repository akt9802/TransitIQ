import nodemailer from "nodemailer";
import { otpEmailHtml, otpEmailSubject, otpEmailText } from "@/lib/mail/otpTemplate";

function smtpAuthError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e);
  if (/535|EAUTH|Authentication failed/i.test(message)) {
    return [
      "Brevo rejected SMTP_USER / SMTP_PASS (535 Authentication failed).",
      "The key is invalid or revoked — generate a new SMTP key at Brevo → Settings → SMTP & API,",
      "then set SMTP_PASS in .env.local (login is the [id]@smtp-brevo.com value, not the relay host).",
    ].join(" ");
  }
  return message;
}

function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS must be set in .env.local for OTP email."
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587 || port === 2525,
    auth: { user, pass },
  });
}

export type SendOtpResult = { delivered: boolean; error?: string };

export async function sendOtpEmail(
  to: string,
  code: string,
  kind: "signup" | "reset" = "signup"
): Promise<SendOtpResult> {
  const from = process.env.SMTP_FROM_EMAIL ?? "noreply@transitiq.local";
  const name = process.env.SMTP_FROM_NAME ?? "TransitIQ";

  const transport = getTransport();
  try {
    await transport.sendMail({
      from: `"${name}" <${from}>`,
      to,
      subject: otpEmailSubject(kind),
      text: otpEmailText(code, kind),
      html: otpEmailHtml(code, kind),
    });
    return { delivered: true };
  } catch (e) {
    const error = smtpAuthError(e);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[dev] SMTP failed: ${error}`);
      console.warn(`[dev] TransitIQ OTP for ${to}: ${code}`);
      return { delivered: false, error };
    }
    throw new Error(error);
  }
}

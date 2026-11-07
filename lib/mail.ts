import nodemailer from "nodemailer";
import { otpEmailHtml, otpEmailSubject, otpEmailText } from "@/lib/mail/otpTemplate";
import { trackingEmailHtml, trackingEmailSubject, trackingEmailText } from "@/lib/mail/trackingTemplate";

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

export async function sendTrackingEmail(input: {
  to: string;
  companyName: string;
  customerName: string;
  link: string;
  vehicle: string | null;
  pickup: string | null;
  dropoff: string | null;
}): Promise<SendOtpResult> {
  const from = process.env.SMTP_FROM_EMAIL ?? "noreply@akt9802.in";
  const name = process.env.SMTP_FROM_NAME ?? "TransitIQ";
  const replyTo = process.env.SMTP_REPLY_TO?.trim() || from;
  const mail = {
    companyName: input.companyName,
    customerName: input.customerName,
    link: input.link,
    vehicle: input.vehicle,
    pickup: input.pickup,
    dropoff: input.dropoff,
  };
  try {
    const transport = getTransport();
    await transport.sendMail({
      from: `"${name}" <${from}>`,
      replyTo,
      to: input.to,
      subject: trackingEmailSubject(input.companyName),
      text: trackingEmailText(mail),
      html: trackingEmailHtml(mail),
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "All",
      },
    });
    return { delivered: true };
  } catch (e) {
    const error = smtpAuthError(e);
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[dev] SMTP failed: ${error}`);
      console.warn(`[dev] Tracking link for ${input.to}: ${input.link}`);
    }
    return { delivered: false, error };
  }
}

export async function sendOtpEmail(
  to: string,
  code: string,
  kind: "signup" | "reset" = "signup"
): Promise<SendOtpResult> {
  const from = process.env.SMTP_FROM_EMAIL ?? "noreply@akt9802.in";
  const name = process.env.SMTP_FROM_NAME ?? "TransitIQ";
  const replyTo = process.env.SMTP_REPLY_TO?.trim() || from;

  const transport = getTransport();
  try {
    await transport.sendMail({
      from: `"${name}" <${from}>`,
      replyTo,
      to,
      subject: otpEmailSubject(kind),
      text: otpEmailText(code, kind),
      html: otpEmailHtml(code, kind),
      headers: {
        "Auto-Submitted": "auto-generated",
        "X-Auto-Response-Suppress": "All",
      },
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

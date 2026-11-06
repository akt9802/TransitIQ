/** Inline-styled HTML for OTP mail. Email clients ignore CSS variables and most <style>. */

const INK = "#1b1e30";
const PAPER = "#f2f5fb";
const PAPER_CARD = "#ffffff";
const ACCENT = "#3d5bd4";
const ACCENT_INK = "#f7f8ff";
const MUTED = "#5c6178";
const RULE = "#c5cad8";
const WARM = "#d4922a";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function digitCells(code: string): string {
  const digits = code.replace(/\D/g, "").slice(0, 6).padEnd(6, "·").split("");
  return digits
    .map(
      (d, i) => `
        <td style="padding:0 4px;">
          <div style="width:44px;height:56px;border:2px solid ${INK};background:${PAPER};color:${INK};font-family:'Courier New',Courier,monospace;font-size:26px;font-weight:700;line-height:56px;text-align:center;border-radius:6px;">${escapeHtml(d)}</div>
        </td>${i === 2 ? `<td style="width:10px;"></td>` : ""}`
    )
    .join("");
}

export type OtpMailKind = "signup" | "reset";

export function otpEmailSubject(kind: OtpMailKind = "signup"): string {
  return kind === "reset"
    ? "Reset your TransitIQ password"
    : "Your TransitIQ verification code";
}

export function otpEmailText(code: string, kind: OtpMailKind = "signup"): string {
  const action =
    kind === "reset"
      ? "Use this code to set a new TransitIQ password."
      : "Use this code to finish signing in to TransitIQ.";
  return [
    "TransitIQ",
    "",
    `Your verification code is: ${code}`,
    "",
    action,
    "This code expires in 10 minutes.",
    "This is an automated no-reply message. Do not reply to this email.",
    "If you did not request this, ignore this email.",
  ].join("\n");
}

export function otpEmailHtml(code: string, kind: OtpMailKind = "signup"): string {
  const safeCode = escapeHtml(code);
  const kicker = kind === "reset" ? "Password reset" : "Fleet owner verification";
  const heading = kind === "reset" ? "Reset your password" : "Your verification code";
  const body =
    kind === "reset"
      ? "Use this code to choose a new password for your TransitIQ account. It works once and expires in 10 minutes."
      : "Use this code to finish signing in to TransitIQ. It works once and expires in 10 minutes.";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${otpEmailSubject(kind)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Your 6-digit TransitIQ code is ${safeCode}. It expires in 10 minutes.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;">
          <tr>
            <td style="padding:0 0 16px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;background:${ACCENT};border:2px solid ${INK};border-radius:6px;color:${ACCENT_INK};font-size:11px;font-weight:700;letter-spacing:0.4px;text-align:center;line-height:36px;">IQ</td>
                  <td style="padding-left:10px;font-size:18px;font-weight:800;color:${INK};letter-spacing:-0.3px;">TransitIQ</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${PAPER_CARD};border:2px solid ${INK};border-radius:8px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:6px;background:${ACCENT};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:32px 32px 8px 32px;">
                    <p style="margin:0 0 6px 0;font-size:13px;color:${MUTED};">${kicker}</p>
                    <h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};font-weight:800;">${heading}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 24px 32px;font-size:15px;line-height:1.55;color:${MUTED};">
                    ${body}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 24px 12px 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        ${digitCells(code)}
                      </tr>
                    </table>
                    <p style="margin:14px 0 0 0;font-size:12px;color:${MUTED};">
                      Code:
                      <strong style="color:${INK};letter-spacing:3px;font-family:'Courier New',Courier,monospace;">${safeCode}</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 28px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};border:1px solid ${RULE};border-radius:6px;">
                      <tr>
                        <td style="padding:12px 14px;font-size:13px;color:${INK};">
                          <span style="display:inline-block;width:8px;height:8px;background:${WARM};border-radius:2px;margin-right:8px;"></span>
                          Expires in <strong>10 minutes</strong>. Do not share this code.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 4px 0 4px;font-size:12px;line-height:1.5;color:${MUTED};">
              This is an automated message from a no-reply address. Replies are not read.
              <br>
              If you did not request this code, you can ignore this email. Your account stays unchanged.
              <br><br>
              TransitIQ · fleet control and road safety
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Inline-styled HTML for the shipment tracking mail. Email clients ignore CSS variables. */

const INK = "#1b1e30";
const PAPER = "#f2f5fb";
const PAPER_CARD = "#ffffff";
const ACCENT = "#3d5bd4";
const ACCENT_INK = "#f7f8ff";
const MUTED = "#5c6178";
const RULE = "#c5cad8";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type TrackingMail = {
  companyName: string;
  customerName: string;
  link: string;
  vehicle: string | null;
  pickup: string | null;
  dropoff: string | null;
};

export function trackingEmailSubject(companyName: string): string {
  return `${companyName}: your shipment is on the way`;
}

export function trackingEmailText(input: TrackingMail): string {
  return [
    input.companyName,
    "",
    `Hello ${input.customerName},`,
    "",
    "Your shipment has started.",
    input.vehicle ? `Truck: ${input.vehicle}` : "",
    input.pickup ? `Pickup: ${input.pickup}` : "",
    input.dropoff ? `Delivery: ${input.dropoff}` : "",
    "",
    "Open this page to see the status, the truck's latest place, and the photos from the trip.",
    "The page stops working when the shipment is delivered.",
    "",
    input.link,
    "",
    "This is an automated message. Replies are not read.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function row(label: string, value: string | null): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:8px 0;border-top:1px solid ${RULE};font-size:13px;color:${MUTED};width:110px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;border-top:1px solid ${RULE};font-size:14px;color:${INK};font-weight:700;">${escapeHtml(value)}</td>
  </tr>`;
}

export function trackingEmailHtml(input: TrackingMail): string {
  const company = escapeHtml(input.companyName);
  const customer = escapeHtml(input.customerName);
  const link = escapeHtml(input.link);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${trackingEmailSubject(input.companyName)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${company} has started your shipment. Track it until it is delivered.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;">
          <tr>
            <td style="padding:0 0 16px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;background:${ACCENT};border:2px solid ${INK};border-radius:6px;color:${ACCENT_INK};font-size:11px;font-weight:700;text-align:center;line-height:36px;">IQ</td>
                  <td style="padding-left:10px;font-size:18px;font-weight:800;color:${INK};">${company}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${PAPER_CARD};border:2px solid ${INK};border-radius:8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:6px;background:${ACCENT};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 8px 32px;">
                    <p style="margin:0 0 6px 0;font-size:13px;color:${MUTED};">Shipment started</p>
                    <h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};font-weight:800;">Your shipment is on the way</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 8px 32px;font-size:15px;line-height:1.55;color:${MUTED};">
                    Hello ${customer}, ${company} has started this trip. The page shows the status, the latest place, and the photos taken along the way.
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 8px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${row("Truck", input.vehicle)}
                      ${row("Pickup", input.pickup)}
                      ${row("Delivery", input.dropoff)}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:20px 32px 8px 32px;">
                    <a href="${link}" style="display:inline-block;background:${ACCENT};color:${ACCENT_INK};border:2px solid ${INK};border-radius:6px;padding:12px 18px;font-size:14px;font-weight:800;text-decoration:none;">Track this shipment</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 28px 32px;font-size:13px;line-height:1.5;color:${MUTED};word-break:break-all;">
                    Or open ${link}
                    <br><br>
                    This page stops working when the shipment is delivered.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 4px 0 4px;font-size:12px;line-height:1.5;color:${MUTED};">
              This is an automated message from a no-reply address. Replies are not read.
              <br><br>
              TransitIQ
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

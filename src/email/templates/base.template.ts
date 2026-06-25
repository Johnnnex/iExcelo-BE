/**
 * iExcelo email base template.
 *
 * Pattern: table-based, 600px card, SF Pro → Helvetica → Arial font stack.
 * Dark header (logo + optional hero-coloured accent line), white body, dark
 * footer with social links. Full light/dark-mode support via @media + [data-ogsc].
 *
 * Usage:
 *   import { baseTemplate } from './base.template';
 *   const html = baseTemplate({ body: '...inner HTML...' });
 */

export interface BaseTemplateOptions {
  /** Inner body HTML — the content between header and footer */
  body: string;
  /** Optional subject (not injected into HTML but returned for convenience) */
  subject?: string;
  /** Override header accent colour — defaults to iExcelo blue */
  accentColor?: string;
}

export function baseTemplate({
  body,
  accentColor = '#007FFF',
}: BaseTemplateOptions): string {
  const year = new Date().getFullYear();

  return /* html */ `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <style>
    /* ── Responsive ────────────────────────────────── */
    @media only screen and (max-width: 600px) {
      .outer-table { padding: 0 !important; }
      .card        { width: 100% !important; border-radius: 0 !important; }
      .body-pad    { padding: 28px 20px !important; }
      .two-col td  { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
    }
    a.cta-btn:hover { opacity: 0.88; }

    /* ── Apple Mail dark mode ──────────────────────── */
    @media (prefers-color-scheme: dark) {
      .outer-bg   { background-color: #111111 !important; }
      .body-bg    { background-color: #1c1c1e !important; }
      .body-text  { color: #e5e5ea !important; }
      .body-sub   { color: #aeaeb2 !important; }
      .body-strong{ color: #ffffff !important; }
      .pill-bg    { background-color: #2c2c2e !important; }
      .pill-text  { color: #e5e5ea !important; }
      .pill-label { color: #aeaeb2 !important; }
      .info-card  { background-color: #1a2438 !important; }
      .divider    { border-color: rgba(255,255,255,0.12) !important; }
    }

    /* ── Gmail Android dark mode ───────────────────── */
    [data-ogsc] .outer-bg  { background-color: #111111 !important; }
    [data-ogsc] .body-bg   { background-color: #1c1c1e !important; }
    [data-ogsc] .body-text { color: #e5e5ea !important; }
    [data-ogsc] .body-sub  { color: #aeaeb2 !important; }
    [data-ogsc] .body-strong{ color: #ffffff !important; }
    [data-ogsc] .pill-bg   { background-color: #2c2c2e !important; }
    [data-ogsc] .pill-text { color: #e5e5ea !important; }
    [data-ogsc] .pill-label{ color: #aeaeb2 !important; }
    [data-ogsc] .info-card { background-color: #1a2438 !important; }
    [data-ogsc] .divider   { border-color: rgba(255,255,255,0.12) !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:'SF Pro Display',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

  <!-- Brevo/ESP pixel buffer -->
  <table class="outer-bg" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f4f4;">
    <tr><td height="1" style="font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>

  <!-- Outer wrapper -->
  <table class="outer-table outer-bg" width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f4f4;padding:40px 16px;">
    <tr>
      <td align="center" valign="top">
        <table class="card" width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;border-radius:10px;">

          <!-- ── HEADER ─────────────────────────────── -->
          <tr>
            <td style="background-color:#0d0d0d;border-radius:10px 10px 0 0;padding:0;">
              <!-- Accent line -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr><td style="height:4px;background-color:${accentColor};border-radius:10px 10px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>
              <!-- Logo row -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:24px 40px 20px;">
                    <img
                      src="LOGO_PLACEHOLDER_URL"
                      alt="iExcelo"
                      width="120"
                      height="auto"
                      style="display:block;width:120px;height:auto;border:0;"
                    />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── WHITE BODY ─────────────────────────── -->
          <tr>
            <td class="body-pad body-bg" style="background-color:#ffffff;padding:40px;">
              ${body}
            </td>
          </tr>

          <!-- ── DARK FOOTER ────────────────────────── -->
          <tr>
            <td style="background-color:#0d0d0d;border-radius:0 0 10px 10px;padding:32px 40px;text-align:center;">
              <!-- Social icons -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 20px;">
                <tr>
                  <td style="padding:0 10px;">
                    <a href="https://x.com/iexcelo" style="text-decoration:none;">
                      <img src="TWITTER_ICON_PLACEHOLDER" width="22" height="22" alt="X / Twitter" style="width:22px;height:22px;display:block;" />
                    </a>
                  </td>
                  <td style="padding:0 10px;">
                    <a href="https://instagram.com/iexcelo" style="text-decoration:none;">
                      <img src="INSTAGRAM_ICON_PLACEHOLDER" width="22" height="22" alt="Instagram" style="width:22px;height:22px;display:block;" />
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:18px;">
                <tr>
                  <td class="divider" style="border-top:1px solid rgba(255,255,255,0.12);font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.6);line-height:1.8;">
                &copy; ${year} iExcelo &nbsp;&middot;&nbsp; All rights reserved.
              </p>
              <p style="margin:0 0 14px;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.8;">
                <a href="mailto:support@iexcelo.com" style="color:rgba(255,255,255,0.45);text-decoration:none;">support@iexcelo.com</a>
              </p>
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.7;font-style:italic;">
                This is an automated message. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/** Reusable CTA button block */
export function ctaButton(
  label: string,
  url: string,
  color = '#007FFF',
): string {
  return /* html */ `
<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 auto 28px;">
  <tr>
    <td style="background-color:${color};border-radius:8px;text-align:center;">
      <a class="cta-btn" href="${url}" style="display:inline-block;padding:15px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

/** Reusable info card (blue left-border accent) */
export function infoCard(content: string, color = '#007FFF'): string {
  return /* html */ `
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" class="info-card" style="background-color:#EFF8FF;border-left:4px solid ${color};border-radius:0 8px 8px 0;margin-bottom:28px;">
  <tr>
    <td style="padding:18px 24px;">
      ${content}
    </td>
  </tr>
</table>`;
}

/** Standard greeting paragraph */
export function greeting(firstName: string): string {
  return `<p class="body-text" style="margin:0 0 20px;font-size:16px;font-weight:600;color:#1a1a1a;line-height:1.75;">Hi ${firstName},</p>`;
}

/** Standard sign-off */
export function signoff(): string {
  return /* html */ `
<p class="body-sub" style="margin:32px 0 0;font-size:15px;color:#444444;line-height:1.75;">
  Warm regards,<br />
  <strong class="body-strong" style="color:#1a1a1a;">The iExcelo Team</strong>
</p>`;
}

/** Fallback link paragraph */
export function fallbackLink(url: string): string {
  return /* html */ `
<p class="body-sub" style="margin:0 0 8px;font-size:13px;color:#667085;line-height:1.6;">
  If the button doesn't work, copy and paste this link into your browser:
</p>
<p style="margin:0 0 28px;word-break:break-all;font-size:13px;color:#007FFF;line-height:1.6;">${url}</p>`;
}

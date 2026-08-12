import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer, { type Transporter } from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_CID = 'sagotka-logo';
const LOGO_PATH = path.join(__dirname, '..', 'public', 'sagotka-logo.png');

const HOST = process.env.SMTP_HOST ?? 'smtp.gmail.com';
const PORT = Number(process.env.SMTP_PORT ?? 465);
const USER = process.env.SMTP_USER ?? '';
const PASS = process.env.SMTP_PASS ?? '';
const FROM = process.env.SMTP_FROM ?? (USER ? `SagotKa <${USER}>` : '');

let transport: Transporter | null = null;

export function smtpConfigured(): boolean {
  return USER.length > 0 && PASS.length > 0;
}

function getTransport(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,
      auth: { user: USER, pass: PASS },
    });
  }
  return transport;
}

const SANS =
  'ui-sans-serif, system-ui, -apple-system, \'Segoe UI\', Roboto, Inter, \'Helvetica Neue\', Arial, sans-serif';
const MONO = 'ui-monospace, \'SF Mono\', SFMono-Regular, Menlo, Consolas, monospace';

const ACCENT = '#de5d50';
const ACCENT_INK = '#fbf7f5';
const INK = '#1a1413';
const PAPER = '#f6f2f0';
const MUTED = '#6f6763';
const RULE = '#d6d0cc';

function logoImg(width: number): string {
  return `<img src="cid:${LOGO_CID}" alt="SagotKa" width="${width}" height="${width}" style="display:block; width:${width}px; height:${width}px; border:0; outline:none;" />`;
}

export function otpEmailHtml(code: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <style>
      @media (prefers-color-scheme: dark) {
        .outer { background-color: #1a1413 !important; }
        .card { background-color: #241d1b !important; border-color: #3a302d !important; }
        .ink { color: #f2ece9 !important; }
        .muted { color: #a89f9a !important; }
        .label { color: #ed7668 !important; }
        .codebox { background-color: #ed7668 !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:${PAPER};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer" style="background-color:${PAPER};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
            <tr>
              <td align="center" style="padding-bottom:20px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td valign="middle">${logoImg(40)}</td>
                    <td valign="middle" style="padding-left:10px; font-family:${SANS}; font-size:18px; font-weight:600; letter-spacing:-0.01em; color:${INK};">SagotKa</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="card" style="border:1px solid ${RULE}; border-radius:8px; background-color:#ffffff; padding:32px;">
                <p class="ink label" style="margin:0 0 6px; font-family:${MONO}; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:${ACCENT};">Verification code</p>
                <h1 class="ink" style="margin:0 0 10px; font-family:${SANS}; font-size:22px; font-weight:600; letter-spacing:-0.025em; color:${INK};">You&rsquo;re almost in</h1>
                <p class="muted" style="margin:0 0 24px; font-family:${SANS}; font-size:14px; line-height:1.5; color:${MUTED};">Use the code below to continue. It expires in 10 minutes.</p>
                <table class="codebox" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-radius:8px; background-color:${ACCENT};">
                  <tr>
                    <td align="center" style="padding:20px 16px;">
                      <span style="font-family:${MONO}; font-size:40px; font-weight:700; letter-spacing:0.35em; text-indent:0.35em; color:#ffffff;">${code}</span>
                    </td>
                  </tr>
                </table>
                <p class="muted" style="margin:24px 0 0; font-family:${SANS}; font-size:13px; line-height:1.5; color:${MUTED};">Didn&rsquo;t request this? You can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:20px;">
                <p style="margin:0; font-family:${SANS}; font-size:12px; color:${MUTED};">SagotKa &mdash; Ask. Collect. Answer.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (!smtpConfigured()) {
    console.log(`[otp] code for ${to}: ${code}`);
    return;
  }
  try {
    await getTransport().sendMail({
      from: FROM,
      to,
      subject: `Your SagotKa verification code: ${code}`,
      text: `Your SagotKa verification code is ${code}. It expires in 10 minutes.`,
      html: otpEmailHtml(code),
      attachments: [
        {
          filename: 'sagotka-logo.png',
          path: LOGO_PATH,
          cid: LOGO_CID,
        },
      ],
    });
  } catch (err) {
    console.error(`[otp] failed to send email to ${to}:`, err);
    console.log(`[otp] code for ${to}: ${code}`);
  }
}

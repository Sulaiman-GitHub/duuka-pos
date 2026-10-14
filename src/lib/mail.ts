import "server-only";

export type MailResult = { sent: boolean };

/**
 * Sends an email through Resend when RESEND_API_KEY and MAIL_FROM are set. Without them nothing is sent (`sent: false`)
 * and callers show the link on screen instead, so local development and first deployments work with no email provider.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return { sent: false };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
      signal: AbortSignal.timeout(8000),
    });
    return { sent: res.ok };
  } catch {
    return { sent: false };
  }
}

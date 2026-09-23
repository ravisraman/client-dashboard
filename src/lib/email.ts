import "server-only";
import { Resend } from "resend";
import { env } from "./env";

export async function sendMagicLinkEmail(to: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY must be set in production to send sign-in emails");
    }
    console.log(`\n[dev] Magic sign-in link for ${to}:\n${url}\n`);
    return;
  }

  const resend = new Resend(apiKey);
  const brand = env.brandName();
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    to,
    subject: `Your sign-in link for ${brand}`,
    text: `Click the link below to sign in to ${brand}. It expires in 15 minutes and can only be used once.\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
    html: `<div style="background:#e9e4da;padding:32px 16px">
<div style="max-width:480px;margin:0 auto;background:#fffdf9;border:1px solid #dcd4c6;padding:32px;font-family:Georgia,'EB Garamond',serif;color:#3c3a37">
<p style="margin:0 0 24px;font-size:18px;letter-spacing:.13em;text-transform:uppercase;color:#26262a">${brand}</p>
<p style="font-size:17px;line-height:1.6;margin:0 0 24px">Click the button below to sign in to your client portal. The link expires in 15 minutes and can only be used once.</p>
<p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;padding:13px 26px;background:#c9301f;color:#fffdf9;font-family:Arial,sans-serif;font-size:13px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none">Sign in</a></p>
<p style="color:#6e6a65;font-size:13px;font-family:Arial,sans-serif;margin:0">If you didn't request this, you can ignore this email.</p>
</div></div>`,
  });
  if (error) throw new Error(`Failed to send sign-in email: ${error.message}`);
}

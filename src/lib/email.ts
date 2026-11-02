import nodemailer, { type Transporter } from 'nodemailer';

export type InquiryMessage = {
  name: string;
  email: string;
  phone?: string | null;
  eventDate?: string | null;
  guests?: string | null;
  venue?: string | null;
  source?: string | null;
  message?: string | null;
};

let transporter: Transporter | null = null;

export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT || 587);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: process.env.SMTP_USER as string, pass: process.env.SMTP_PASS as string }
  });
  return transporter;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character] as string));
}

export async function sendInquiryEmail(to: string, inquiry: InquiryMessage) {
  if (!to) return { sent: false, error: 'No recipient email is configured.' };
  if (!emailConfigured()) {
    return { sent: false, error: 'Email is not configured on the server (SMTP settings missing).' };
  }

  const from = process.env.INQUIRY_FROM || (process.env.SMTP_USER as string);
  const rows: [string, string | null | undefined][] = [
    ['Name', inquiry.name],
    ['Email', inquiry.email],
    ['Phone', inquiry.phone],
    ['Event date', inquiry.eventDate],
    ['Guests', inquiry.guests],
    ['Venue / location', inquiry.venue],
    ['Heard via', inquiry.source]
  ];
  const details = rows
    .filter(([, value]) => value && String(value).trim())
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join('\n');
  const text = `New enquiry from the Perfectevent4u website\n\n${details}\n\nVision / message:\n${inquiry.message || '(not provided)'}\n`;
  const html = `<h2>New enquiry</h2><table cellpadding="6" style="border-collapse:collapse">${
    rows
      .filter(([, value]) => value && String(value).trim())
      .map(([label, value]) => `<tr><td style="color:#666">${escapeHtml(label)}</td><td><strong>${escapeHtml(String(value).trim())}</strong></td></tr>`)
      .join('')
  }</table><p style="margin-top:16px;color:#666">Vision / message</p><p style="white-space:pre-line">${escapeHtml(inquiry.message || '(not provided)')}</p>`;

  try {
    await getTransporter().sendMail({
      from,
      to,
      replyTo: inquiry.email,
      subject: `New enquiry from ${inquiry.name}`,
      text,
      html
    });
    return { sent: true as const };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'The email could not be sent.' };
  }
}

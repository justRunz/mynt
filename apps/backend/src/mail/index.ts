import nodemailer from 'nodemailer'

import { env } from '../env.js'

/**
 * Sending mail, which is the one thing this server does that leaves the machine.
 *
 * The transport is created once. nodemailer pools connections, and building one
 * per message would open and close an SMTP session for every sign-up.
 */
const transport = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  // Plain SMTP on 1025 locally, STARTTLS on 587 in production. Deciding by port
  // rather than by a separate flag, because the flag and the port could disagree
  // and only one of them would be right.
  secure: env.smtpPort === 465,
  // Omitted entirely rather than left empty when there are no credentials:
  // nodemailer attempts to authenticate if the object exists at all, and Mailpit
  // is not asking.
  ...(env.smtpUser ? { auth: { user: env.smtpUser, pass: env.smtpPassword } } : {}),
})

export interface Message {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Sends, and never lets a failure become the caller's problem.
 *
 * This is deliberate and it is the difference between a recoverable state and a
 * dead account. Sign-up has already committed by the time a message goes out; if
 * a bounced relay made the request fail, the collector would be told their
 * account was not created when it was, and could never create it again -- the
 * address is taken.
 *
 * So a failure is logged loudly and swallowed. Both flows are built to survive
 * it: signing in with an unverified address sends a fresh link, and the forgotten
 * password form can simply be used again.
 */
export async function sendMail(message: Message): Promise<void> {
  try {
    await transport.sendMail({ from: env.mailFrom, ...message })
  } catch (error) {
    console.error('mail could not be sent', { to: message.to, subject: message.subject }, error)
  }
}

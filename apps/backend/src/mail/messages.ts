import { env } from '../env.js'
import type { Message } from './index.js'

/**
 * What the two emails say.
 *
 * In French, because they are read by the collector, and the app's rule is that
 * everything a person reads is French while everything a programmer reads is
 * English. They are the only strings in this server that a user ever sees, which
 * is why they are here rather than in i18n: the front end never renders them.
 *
 * Both parts of every message. A text/plain alternative is not politeness -- a
 * message with an HTML body and nothing else is a strong spam signal, and some
 * clients still show the text.
 */

/** No image, no external stylesheet, no web font. A mail client will strip half
 *  of it and block the rest, and a link that survives everything is worth more
 *  than a design that survives nothing. */
function wrap(title: string, body: string, action: string, url: string): string {
  return `<div style="font-family: system-ui, -apple-system, sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a; max-width: 34rem;">
  <h1 style="font-size: 20px; margin: 0 0 1rem;">${title}</h1>
  <p style="margin: 0 0 1.5rem;">${body}</p>
  <p style="margin: 0 0 1.5rem;">
    <a href="${url}" style="background: #1a1a1a; color: #fff; padding: 0.75rem 1.25rem; border-radius: 999px; text-decoration: none; display: inline-block;">${action}</a>
  </p>
  <p style="margin: 0; font-size: 14px; color: #6b6b6b;">
    Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :<br>
    <span style="word-break: break-all;">${url}</span>
  </p>
</div>`
}

export function verificationMessage(to: string, token: string): Message {
  const url = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`
  const body =
    'Confirmez cette adresse pour ouvrir votre collection. Le lien est valable 24 heures.'

  return {
    to,
    subject: 'Confirmez votre adresse — Mynt',
    text: `Confirmez cette adresse pour ouvrir votre collection.\n\n${url}\n\nLe lien est valable 24 heures. Si vous n'avez pas créé de compte, ignorez ce message.`,
    html: wrap('Confirmez votre adresse', body, "Confirmer l'adresse", url),
  }
}

export function passwordResetMessage(to: string, token: string): Message {
  const url = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`
  const body =
    'Choisissez un nouveau mot de passe. Le lien est valable une heure, et ne fonctionne qu’une fois.'

  return {
    to,
    subject: 'Réinitialiser votre mot de passe — Mynt',
    // The reassurance matters here and not in the other message: this one can
    // arrive unrequested, sent by somebody who typed an address that happens to
    // be yours.
    text: `Choisissez un nouveau mot de passe.\n\n${url}\n\nLe lien est valable une heure et ne fonctionne qu'une fois. Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.`,
    html: wrap('Nouveau mot de passe', body, 'Choisir un mot de passe', url),
  }
}

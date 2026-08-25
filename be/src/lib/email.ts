import nodemailer from 'nodemailer'

import { env, isSmtpConfigured } from '../config/env'
import {
  welcomeTrialEmailHtml,
  welcomeTrialEmailSubject,
  welcomeTrialEmailText,
} from './emailTemplates/welcomeTrial'

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured')
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    })
  }
  return transporter
}

export class SmtpNotConfiguredError extends Error {
  constructor() {
    super('SMTP is not configured')
    this.name = 'SmtpNotConfiguredError'
  }
}

type SendMailInput = {
  to: string
  subject: string
  html: string
  text: string
}

export async function sendMail(input: SendMailInput): Promise<void> {
  if (!isSmtpConfigured()) {
    console.warn('[email] SMTP not configured — skipping send to', input.to)
    throw new SmtpNotConfiguredError()
  }

  const transport = getTransporter()
  await transport.sendMail({
    from: env.smtp.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })
}

export async function sendWelcomeTrialEmail(
  to: string,
  fullName: string,
  licenseKey: string,
): Promise<void> {
  const params = {
    fullName,
    licenseKey,
    appUrl: env.appPublicUrl,
  }

  await sendMail({
    to,
    subject: welcomeTrialEmailSubject(params),
    html: welcomeTrialEmailHtml(params),
    text: welcomeTrialEmailText(params),
  })
}

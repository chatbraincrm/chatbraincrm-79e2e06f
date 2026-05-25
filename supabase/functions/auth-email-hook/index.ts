import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { jwtVerify } from 'npm:jose'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const SITE_NAME = 'ChatBrain CRM'
const ROOT_DOMAIN = 'chatbraincrm.com.br'
const FROM_EMAIL = `${SITE_NAME} <noreply@${ROOT_DOMAIN}>`

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirme seu e-mail',
  invite: 'Você foi convidado ao ChatBrain CRM',
  magiclink: 'Seu link de acesso',
  recovery: 'Redefina sua senha',
  email_change: 'Confirme seu novo e-mail',
  reauthentication: 'Seu código de verificação',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

async function verifyRequest(req: Request): Promise<boolean> {
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!hookSecret) {
    console.warn('SEND_EMAIL_HOOK_SECRET não configurado — requisição rejeitada')
    return false
  }
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return false
  try {
    await jwtVerify(authHeader.slice(7), new TextEncoder().encode(hookSecret))
    return true
  } catch (err) {
    console.error('Falha na verificação do JWT do hook', err)
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  if (!(await verifyRequest(req))) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const messagingType: string = body.messaging_type
  const emailData = body.email_data ?? {}
  const userEmail: string = body.user?.email

  if (!userEmail) {
    return new Response(JSON.stringify({ error: 'E-mail do destinatário ausente' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const Template = EMAIL_TEMPLATES[messagingType]
  if (!Template) {
    console.error('Tipo de mensagem desconhecido', { messagingType })
    return new Response(JSON.stringify({ error: `Tipo desconhecido: ${messagingType}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Monta URL de confirmação no formato padrão do Supabase Auth
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const redirectTo = emailData.redirect_to ?? `https://${ROOT_DOMAIN}`
  const tokenHash = emailData.token_hash ?? ''
  const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token_hash=${encodeURIComponent(tokenHash)}&type=${messagingType}&redirect_to=${encodeURIComponent(redirectTo)}`

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: userEmail,
    confirmationUrl,
    token: emailData.token ?? '',
    email: userEmail,
    oldEmail: body.user?.email ?? '',
    newEmail: emailData.new_email ?? '',
  }

  const html = await renderAsync(React.createElement(Template, templateProps))
  const text = await renderAsync(React.createElement(Template, templateProps), { plainText: true })

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('RESEND_API_KEY não configurado')
    return new Response(JSON.stringify({ error: 'Serviço de e-mail não configurado' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [userEmail],
      subject: EMAIL_SUBJECTS[messagingType] ?? 'Notificação',
      html,
      text,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    console.error('Erro no Resend', { status: resp.status, error: err, messagingType, userEmail })
    return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.log('E-mail de autenticação enviado via Resend', { messagingType, userEmail })
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

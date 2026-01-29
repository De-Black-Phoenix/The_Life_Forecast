# Environment Setup Guide

This guide explains how to obtain every `.env` value required by the backend.

## 1) Runtime

Set the runtime values:

```
NODE_ENV=production
PORT=3000
```


Notes:
- `NODE_ENV`: use `production` for deployment, `development` locally.
- `PORT`: match your hosting platform or reverse proxy configuration.

## 2) Twilio (WhatsApp)

You need a Twilio account and WhatsApp sender.

Required keys:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

Steps:
- Sign in to the Twilio Console.
- Go to **Console → Account → General Settings**.
  - Copy **Account SID** → `TWILIO_ACCOUNT_SID`.
  - Copy **Auth Token** → `TWILIO_AUTH_TOKEN`.
- Go to **Console → Messaging → Senders → WhatsApp Senders**.
  - Copy the sender number in E.164 format.
  - Set `TWILIO_WHATSAPP_FROM` as `whatsapp:+E164NUMBER`.

## 3) Webhook Base URL

Required key:

```
WEBHOOK_BASE_URL=https://your-domain.com
```

Steps:
- Use your public HTTPS domain (must be reachable by Twilio).
- If your webhook is exposed at `https://bot.example.com/webhook/whatsapp`,
  then `WEBHOOK_BASE_URL` must be `https://bot.example.com`.

## 4) Supabase (PostgreSQL)

Required keys:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Steps:
- Sign in to Supabase and open your project.
- Go to **Project Settings → API**.
  - Copy **Project URL** → `SUPABASE_URL`.
  - Copy **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY`.

Security note:
- The service role key is server-side only. Never expose it to clients.

## 5) Admin Token

Required key:

```
ADMIN_TOKEN=your_admin_token
```

Steps:
- Generate a strong random token (32+ chars).
- Store it securely and use it in the `Authorization: Bearer <token>`
  or `X-Admin-Token: <token>` header for admin requests.

## 6) Final `.env` Template

```
NODE_ENV=production
PORT=3000

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

WEBHOOK_BASE_URL=https://your-domain.com

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

ADMIN_TOKEN=your_admin_token
```

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { appUrl } = await req.json()
    const cfg = await prisma.settings.findUnique({ where: { id: 'default' } })
    if (!cfg?.hrBotToken) {
      return NextResponse.json({ error: 'Bot token sozlanmagan' }, { status: 400 })
    }
    const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/bot`
    const res = await fetch(`https://api.telegram.org/bot${cfg.hrBotToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] }),
    })
    const data = await res.json()
    if (!data.ok) return NextResponse.json({ error: data.description }, { status: 400 })
    return NextResponse.json({ ok: true, webhookUrl })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

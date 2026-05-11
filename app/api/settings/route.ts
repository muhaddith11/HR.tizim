import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const db = await prisma.settings.findUnique({ where: { id: 'default' } })
    return NextResponse.json({
      hrBotToken:    db?.hrBotToken    ?? process.env.BOT_TOKEN    ?? '',
      hrAdminChatId: db?.hrAdminChatId ?? process.env.ADMIN_ID     ?? '',
      officeLat:     db?.officeLat     ?? (process.env.OFFICE_LAT  ? parseFloat(process.env.OFFICE_LAT)  : null),
      officeLon:     db?.officeLon     ?? (process.env.OFFICE_LON  ? parseFloat(process.env.OFFICE_LON)  : null),
      officeRadius:  db?.officeRadius  ?? (process.env.OFFICE_RADIUS ? parseFloat(process.env.OFFICE_RADIUS) : 150),
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const s = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        hrBotToken:    body.hrBotToken    || null,
        hrAdminChatId: body.hrAdminChatId || null,
        officeLat:     body.officeLat     ? parseFloat(body.officeLat)     : null,
        officeLon:     body.officeLon     ? parseFloat(body.officeLon)     : null,
        officeRadius:  body.officeRadius  ? parseFloat(body.officeRadius)  : 150,
      },
      create: {
        id:            'default',
        hrBotToken:    body.hrBotToken    || null,
        hrAdminChatId: body.hrAdminChatId || null,
        officeLat:     body.officeLat     ? parseFloat(body.officeLat)     : null,
        officeLon:     body.officeLon     ? parseFloat(body.officeLon)     : null,
        officeRadius:  body.officeRadius  ? parseFloat(body.officeRadius)  : 150,
      },
    })
    return NextResponse.json(s)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

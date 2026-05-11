import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTashkentDate, formatTime, getSettings, sendMsg } from '@/lib/bot'

export const dynamic = 'force-dynamic'

// Vercel cron: runs at 19:00 UTC = 00:00 Tashkent (midnight)
// Sends full daily summary to admin
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cfg = await getSettings()
  if (!cfg.hrBotToken || !cfg.hrAdminChatId) {
    return NextResponse.json({ ok: true })
  }

  // Report is for today (which just ended in Tashkent timezone)
  const today = getTashkentDate()

  const [allEmployees, attendances] = await Promise.all([
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.attendance.findMany({
      where: { workDate: today },
      include: { employee: true },
      orderBy: { checkIn: 'asc' },
    }),
  ])

  const presentIds = new Set(attendances.map(a => a.employeeId))
  const absent = allEmployees.filter(e => !presentIds.has(e.id))
  const onTime = attendances.filter(a => !a.isLate)
  const lateArr = attendances.filter(a => a.isLate)

  const lines: string[] = [
    `📊 <b>Kunlik hisobot — ${today}</b>`,
    `👥 Jami xodim: ${allEmployees.length} ta\n`,
  ]

  lines.push(`✅ O'z vaqtida keldi: <b>${onTime.length} ta</b>`)
  lines.push(`⚠️ Kechikdi: <b>${lateArr.length} ta</b>`)
  lines.push(`❌ Kelmadi: <b>${absent.length} ta</b>`)

  if (onTime.length > 0) {
    lines.push('\n<b>✅ O\'z vaqtida:</b>')
    for (const a of onTime) {
      const ci = formatTime(a.checkIn)
      const co = a.checkOut ? formatTime(a.checkOut) : 'chiqmadi'
      let dur = ''
      if (a.checkIn && a.checkOut) {
        const ms = new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()
        const h = Math.floor(ms / 3600000)
        const m = Math.floor((ms % 3600000) / 60000)
        dur = ` | ⏱ ${h}s ${m}d`
      }
      lines.push(`• ${a.employee.name} — ${ci}→${co}${dur}`)
    }
  }

  if (lateArr.length > 0) {
    lines.push('\n<b>⚠️ Kechikib keldi:</b>')
    for (const a of lateArr) {
      const ci = formatTime(a.checkIn)
      const co = a.checkOut ? formatTime(a.checkOut) : 'chiqmadi'
      lines.push(`• ${a.employee.name} — keldi ${ci}, ketdi ${co}`)
    }
  }

  if (absent.length > 0) {
    lines.push('\n<b>❌ Kelmadi:</b>')
    absent.forEach((e, i) => {
      lines.push(`${i + 1}. ${e.name}${e.position ? ` — ${e.position}` : ''}`)
    })
  }

  await sendMsg(cfg.hrBotToken, cfg.hrAdminChatId, lines.join('\n'))
  return NextResponse.json({ ok: true })
}

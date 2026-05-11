import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTashkentDate, formatTime, getSettings, sendMsg } from '@/lib/bot'

export const dynamic = 'force-dynamic'

// Vercel cron: runs at 04:30 UTC = 09:30 Tashkent
// Sends admin alert about who hasn't arrived yet
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cfg = await getSettings()
  if (!cfg.hrBotToken || !cfg.hrAdminChatId) {
    return NextResponse.json({ ok: true })
  }

  const today = getTashkentDate()

  const [allEmployees, attendances] = await Promise.all([
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.attendance.findMany({ where: { workDate: today } }),
  ])

  const presentIds = new Set(attendances.map(a => a.employeeId))
  const notArrived = allEmployees.filter(e => !presentIds.has(e.id))
  const late = attendances.filter(a => a.isLate)

  const lines: string[] = [`⏰ <b>Soat 09:30 holati — ${today}</b>\n`]

  if (notArrived.length === 0 && late.length === 0) {
    lines.push('✅ Barcha xodimlar o\'z vaqtida keldi!')
  } else {
    if (notArrived.length > 0) {
      lines.push(`❌ <b>Hali kelmagan (${notArrived.length} ta):</b>`)
      notArrived.forEach((e, i) => {
        lines.push(`${i + 1}. ${e.name}${e.position ? ` — ${e.position}` : ''}`)
      })
    }
    if (late.length > 0) {
      lines.push('')
      lines.push(`⚠️ <b>Kechikib kelgan (${late.length} ta):</b>`)
      for (const a of late) {
        const emp = allEmployees.find(e => e.id === a.employeeId)
        if (emp) lines.push(`• ${emp.name} — ${formatTime(a.checkIn)}`)
      }
    }
  }

  await sendMsg(cfg.hrBotToken, cfg.hrAdminChatId, lines.join('\n'))
  return NextResponse.json({ ok: true })
}

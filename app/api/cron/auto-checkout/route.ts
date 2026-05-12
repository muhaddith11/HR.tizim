import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTashkentDate, getSettings, sendMsg } from '@/lib/bot'

export const dynamic = 'force-dynamic'

// Vercel cron: runs at 18:00 UTC = 23:00 Tashkent
// Auto-closes any open attendances (employee forgot to check out)
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = getTashkentDate()
  const now = new Date() // 18:00 UTC = 23:00 Tashkent

  const openAttendances = await prisma.attendance.findMany({
    where: { workDate: today, checkOut: null, checkIn: { not: null } },
    include: { employee: true },
  })

  if (openAttendances.length === 0) return NextResponse.json({ ok: true, closed: 0 })

  await prisma.attendance.updateMany({
    where: { id: { in: openAttendances.map(a => a.id) } },
    data: { checkOut: now },
  })

  const cfg = await getSettings()
  if (cfg.hrBotToken && cfg.hrAdminChatId) {
    const names = openAttendances.map(a => `• ${a.employee.name}`).join('\n')
    await sendMsg(cfg.hrBotToken, cfg.hrAdminChatId,
      `🕚 <b>Avtomatik chiqish (23:00)</b>\n\nQuyidagi xodimlar ketishni belgilamagan, tizim avtomatik yopdi:\n\n${names}`)
  }

  return NextResponse.json({ ok: true, closed: openAttendances.length })
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  haversineMeters, getTashkentDate, formatTime,
  sendMenu, askLocation, sendMsg, answerCb, getSettings,
} from '@/lib/bot'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const update = await req.json()
    const cfg = await getSettings()
    const token = cfg?.hrBotToken
    if (!token) return NextResponse.json({ ok: true })

    const adminId = cfg?.hrAdminChatId ?? ''

    // /start buyrug'i
    if (update.message?.text === '/start') {
      const tgId = String(update.message.from.id)
      const chatId = update.message.chat.id
      const emp = await prisma.employee.findUnique({ where: { telegramId: tgId } })

      if (!emp || !emp.isActive) {
        await sendMsg(token, chatId,
          '❌ Siz tizimda ro\'yxatdan o\'tmagan yoki faol xodim emassiz.\n\nAdmin bilan bog\'laning.')
        return NextResponse.json({ ok: true })
      }
      await sendMenu(token, chatId, `Salom, <b>${emp.name}</b>! 👋\n\nQuyidagi tugmani bosing:`)
      return NextResponse.json({ ok: true })
    }

    // Admin buyruqlari
    if (update.message?.text?.startsWith('/') && String(update.message.from.id) === adminId) {
      const chatId = update.message.chat.id
      const cmd = update.message.text.split(' ')[0]

      if (cmd === '/bugun') {
        const today = getTashkentDate()
        const rows = await prisma.attendance.findMany({
          where: { workDate: today },
          include: { employee: true },
          orderBy: { checkIn: 'asc' },
        })
        if (rows.length === 0) {
          await sendMsg(token, chatId, `📋 <b>Bugungi davomat (${today})</b>\n\nHali hech kim kelmagan.`)
        } else {
          const lines = rows.map(r => {
            const ci = formatTime(r.checkIn)
            const co = r.checkOut ? formatTime(r.checkOut) : 'ishda ⚡'
            return `👤 <b>${r.employee.name}</b>\n   Keldi: ${ci} | Ketdi: ${co}`
          })
          await sendMsg(token, chatId, `📋 <b>Bugungi davomat (${today})</b>\n\n${lines.join('\n\n')}`)
        }
      }

      if (cmd === '/xodimlar') {
        const emps = await prisma.employee.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
        if (emps.length === 0) {
          await sendMsg(token, chatId, '👥 Xodimlar yo\'q.')
        } else {
          const lines = emps.map((e, i) =>
            `${i + 1}. <b>${e.name}</b>${e.position ? ` — ${e.position}` : ''}\n   ID: <code>${e.telegramId}</code>`)
          await sendMsg(token, chatId, `👥 <b>Xodimlar (${emps.length} ta):</b>\n\n${lines.join('\n\n')}`)
        }
      }

      return NextResponse.json({ ok: true })
    }

    // Lokatsiya xabari
    if (update.message?.location) {
      const tgId = String(update.message.from.id)
      const chatId = update.message.chat.id
      const { latitude, longitude } = update.message.location

      const emp = await prisma.employee.findUnique({ where: { telegramId: tgId } })
      if (!emp || !emp.isActive || !emp.pendingAction) {
        await sendMenu(token, chatId, 'Avval quyidagi tugmani bosing:')
        return NextResponse.json({ ok: true })
      }

      // Lokatsiya tekshiruvi
      if (cfg?.officeLat && cfg?.officeLon) {
        const radius = cfg.officeRadius ?? 150
        const dist = haversineMeters(latitude, longitude, cfg.officeLat, cfg.officeLon)
        if (dist > radius) {
          await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: null } })
          await sendMenu(token, chatId,
            `❌ <b>Siz ishxona hududida emassiz!</b>\n\n📏 Masofa: <b>${Math.round(dist)} metr</b>\n🎯 Chegara: ${Math.round(radius)} metr\n\nIshxonaga keling va qayta urinib ko\'ring.`)
          return NextResponse.json({ ok: true })
        }
      }

      const today = getTashkentDate()
      const now = new Date()

      if (emp.pendingAction === 'checkin') {
        const existing = await prisma.attendance.findFirst({
          where: { employeeId: emp.id, workDate: today, checkOut: null },
        })
        if (existing) {
          await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: null } })
          await sendMenu(token, chatId, '⚠️ Siz allaqachon keldingiz deb belgilangansiz.\nKetayotganda "Ketdim" tugmasini bosing.')
          return NextResponse.json({ ok: true })
        }

        await prisma.attendance.create({
          data: { employeeId: emp.id, workDate: today, checkIn: now, checkInLat: latitude, checkInLon: longitude },
        })
        await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: null } })

        const t = formatTime(now)
        await sendMsg(token, chatId,
          `✅ <b>Kelish belgilandi!</b>\n\n👤 ${emp.name}\n🕐 ${t}\n📅 ${today}\n\nYaxshi ish kuni! 💪`)

        if (adminId) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: adminId, text: `✅ <b>${emp.name}</b> ishga keldi — 🕐 ${t}`, parse_mode: 'HTML' }),
          })
        }
      } else if (emp.pendingAction === 'checkout') {
        const open = await prisma.attendance.findFirst({
          where: { employeeId: emp.id, workDate: today, checkOut: null },
          orderBy: { checkIn: 'desc' },
        })
        if (!open) {
          await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: null } })
          await sendMenu(token, chatId, '⚠️ Bugun kelish belgilanmagan.\nAvval "Keldim" tugmasini bosing.')
          return NextResponse.json({ ok: true })
        }

        await prisma.attendance.update({
          where: { id: open.id },
          data: { checkOut: now, checkOutLat: latitude, checkOutLon: longitude },
        })
        await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: null } })

        const ci = formatTime(open.checkIn)
        const co = formatTime(now)
        const diff = now.getTime() - (open.checkIn?.getTime() ?? now.getTime())
        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)

        await sendMsg(token, chatId,
          `🚪 <b>Ketish belgilandi!</b>\n\n👤 ${emp.name}\n🕐 Keldi: ${ci} | Ketdi: ${co}\n⏱ Ishladi: ${h} soat ${m} daqiqa\n\nSog' bo'ling! 👋`)

        if (adminId) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: adminId, text: `🚪 <b>${emp.name}</b> ketdi — 🕐 ${co} | ⏱ ${h}s ${m}d`, parse_mode: 'HTML' }),
          })
        }
      }

      return NextResponse.json({ ok: true })
    }

    // Inline tugma bosildi
    if (update.callback_query) {
      const tgId = String(update.callback_query.from.id)
      const chatId = update.callback_query.message.chat.id
      const action = update.callback_query.data as string

      await answerCb(token, update.callback_query.id)

      const emp = await prisma.employee.findUnique({ where: { telegramId: tgId } })
      if (!emp || !emp.isActive) {
        await sendMsg(token, chatId, '❌ Siz tizimda ro\'yxatdan o\'tmagan.')
        return NextResponse.json({ ok: true })
      }

      if (action === 'checkin') {
        await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: 'checkin' } })
        await askLocation(token, chatId, '📍 Kelishni tasdiqlash uchun lokatsiyangizni yuboring:')
      } else if (action === 'checkout') {
        await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: 'checkout' } })
        await askLocation(token, chatId, '📍 Ketishni tasdiqlash uchun lokatsiyangizni yuboring:')
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Bot xatosi:', err)
    return NextResponse.json({ ok: true })
  }
}

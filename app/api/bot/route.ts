import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  haversineMeters, getTashkentDate, formatTime,
  sendMenu, askLocation, sendMsg, answerCb, getSettings,
} from '@/lib/bot'

export const dynamic = 'force-dynamic'

async function tg(token: string, method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}

export async function POST(req: Request) {
  try {
    const update = await req.json()
    const cfg = await getSettings()
    const token = cfg?.hrBotToken
    if (!token) return NextResponse.json({ ok: true })

    const adminId = cfg?.hrAdminChatId ?? ''

    // /start — telefon raqam so'rash
    if (update.message?.text === '/start') {
      const tgId = String(update.message.from.id)
      const chatId = update.message.chat.id

      const emp = await prisma.employee.findUnique({ where: { telegramId: tgId } })
      if (emp && emp.isActive) {
        await sendMenu(token, chatId, `Salom, <b>${emp.name}</b>! 👋\n\nQuyidagi tugmani bosing:`)
        return NextResponse.json({ ok: true })
      }

      // Telefon raqam so'rash
      await tg(token, 'sendMessage', {
        chat_id: chatId,
        text: '👋 Salom! Tizimga kirish uchun telefon raqamingizni ulashing:',
        reply_markup: {
          keyboard: [[{ text: '📱 Telefon raqamini ulashing', request_contact: true }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      })
      return NextResponse.json({ ok: true })
    }

    // Telefon raqam keldi
    if (update.message?.contact) {
      const tgId = String(update.message.from.id)
      const chatId = update.message.chat.id
      const rawPhone = update.message.contact.phone_number
      const phone = normalizePhone(rawPhone)

      const emp = await prisma.employee.findFirst({
        where: {
          phone: { endsWith: phone.slice(-9) },
          isActive: true,
        },
      })

      if (!emp) {
        await sendMsg(token, chatId, '❌ Bu telefon raqam tizimda topilmadi.\n\nAdmin bilan bog\'laning.')
        return NextResponse.json({ ok: true })
      }

      // TelegramId ni saqlash
      await prisma.employee.update({
        where: { id: emp.id },
        data: { telegramId: tgId },
      })

      await sendMenu(token, chatId, `✅ Xush kelibsiz, <b>${emp.name}</b>!\n\nEndi siz tizimdan foydalana olasiz:`)
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
            `${i + 1}. <b>${e.name}</b>${e.position ? ` — ${e.position}` : ''}\n   📱 ${e.phone}`)
          await sendMsg(token, chatId, `👥 <b>Xodimlar (${emps.length} ta):</b>\n\n${lines.join('\n\n')}`)
        }
      }

      return NextResponse.json({ ok: true })
    }

    // Lokatsiya
    if (update.message?.location) {
      const tgId = String(update.message.from.id)
      const chatId = update.message.chat.id
      const { latitude, longitude } = update.message.location

      const emp = await prisma.employee.findUnique({ where: { telegramId: tgId } })
      if (!emp || !emp.isActive || !emp.pendingAction) {
        await sendMenu(token, chatId, 'Avval quyidagi tugmani bosing:')
        return NextResponse.json({ ok: true })
      }

      if (cfg?.officeLat && cfg?.officeLon) {
        const radius = cfg.officeRadius ?? 150
        const dist = haversineMeters(latitude, longitude, cfg.officeLat, cfg.officeLon)
        if (dist > radius) {
          await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: null } })
          await sendMenu(token, chatId,
            `❌ <b>Siz ishxona hududida emassiz!</b>\n\n📏 Masofa: <b>${Math.round(dist)} metr</b>\n🎯 Chegara: ${Math.round(radius)} metr\n\nIshxonaga keling va qayta urinib ko'ring.`)
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
          await sendMenu(token, chatId, '⚠️ Siz allaqachon keldingiz deb belgilangansiz.')
          return NextResponse.json({ ok: true })
        }
        const tashkentHour = (now.getUTCHours() + 5) % 24
        const tashkentMin = now.getUTCMinutes()
        const isLate = tashkentHour > 9 || (tashkentHour === 9 && tashkentMin >= 30)
        const lateMinutes = isLate ? (tashkentHour * 60 + tashkentMin) - (9 * 60 + 30) : 0
        await prisma.attendance.create({
          data: { employeeId: emp.id, workDate: today, checkIn: now, checkInLat: latitude, checkInLon: longitude, isLate },
        })
        await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: null } })
        const t = formatTime(now)
        const lateMsg = isLate
          ? `\n⚠️ Kechikish: <b>${Math.floor(lateMinutes / 60) > 0 ? `${Math.floor(lateMinutes / 60)} soat ` : ''}${lateMinutes % 60} daqiqa</b>`
          : '\n✅ O\'z vaqtida keldingiz!'
        await sendMsg(token, chatId, `✅ <b>Kelish belgilandi!</b>\n\n👤 ${emp.name}\n🕐 ${t} | 📅 ${today}${lateMsg}`)
        if (adminId) await tg(token, 'sendMessage', { chat_id: adminId, text: `✅ <b>${emp.name}</b> ishga keldi — 🕐 ${t}`, parse_mode: 'HTML' })

      } else if (emp.pendingAction === 'checkout') {
        const open = await prisma.attendance.findFirst({
          where: { employeeId: emp.id, workDate: today, checkOut: null },
          orderBy: { checkIn: 'desc' },
        })
        if (!open) {
          await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: null } })
          await sendMenu(token, chatId, '⚠️ Bugun kelish belgilanmagan.')
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
        await sendMsg(token, chatId, `🚪 <b>Ketish belgilandi!</b>\n\n👤 ${emp.name}\n🕐 Keldi: ${ci} | Ketdi: ${co}\n⏱ Ishladi: ${h}s ${m}d\n\nSog' bo'ling! 👋`)
        if (adminId) await tg(token, 'sendMessage', { chat_id: adminId, text: `🚪 <b>${emp.name}</b> ketdi — 🕐 ${co} | ⏱ ${h}s ${m}d`, parse_mode: 'HTML' })
      }

      return NextResponse.json({ ok: true })
    }

    // Bormayman tugmasi
    if (update.message?.text === '🚫 Bormayman') {
      const tgId = String(update.message.from.id)
      const chatId = update.message.chat.id

      const emp = await prisma.employee.findUnique({ where: { telegramId: tgId } })
      if (!emp || !emp.isActive) {
        await sendMenu(token, chatId, '❌ Avval /start bosing.')
        return NextResponse.json({ ok: true })
      }

      const today = getTashkentDate()
      const existing = await prisma.attendance.findFirst({
        where: { employeeId: emp.id, workDate: today },
      })
      if (existing) {
        await sendMenu(token, chatId, '⚠️ Bugun allaqachon davomat belgilangan.')
        return NextResponse.json({ ok: true })
      }

      await tg(token, 'sendMessage', {
        chat_id: chatId,
        text: '📝 <b>Sababni tanlang:</b>',
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🤒 Kasalman', callback_data: 'abs_sick' }],
            [{ text: '🏖️ Dam olyapman', callback_data: 'abs_vacation' }],
            [{ text: '💼 Ishim bor', callback_data: 'abs_busy' }],
            [{ text: '✍️ Boshqa sabab', callback_data: 'abs_other' }],
          ],
        },
      })
      return NextResponse.json({ ok: true })
    }

    // Doimiy tugmalar: ✅ Keldim / 🚪 Ketdim
    const msgText = update.message?.text
    if (msgText === '✅ Keldim' || msgText === '🚪 Ketdim') {
      const tgId = String(update.message.from.id)
      const chatId = update.message.chat.id

      const emp = await prisma.employee.findUnique({ where: { telegramId: tgId } })
      if (!emp || !emp.isActive) {
        await sendMenu(token, chatId, '❌ Avval /start bosing va telefon raqamingizni ulashing.')
        return NextResponse.json({ ok: true })
      }
      if (msgText === '✅ Keldim') {
        await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: 'checkin' } })
        await askLocation(token, chatId, '📍 Kelishni tasdiqlash uchun lokatsiyangizni yuboring:')
      } else {
        await prisma.employee.update({ where: { id: emp.id }, data: { pendingAction: 'checkout' } })
        await askLocation(token, chatId, '📍 Ketishni tasdiqlash uchun lokatsiyangizni yuboring:')
      }
      return NextResponse.json({ ok: true })
    }

    // Sabab tanlash (inline callback)
    if (update.callback_query) {
      const tgId = String(update.callback_query.from.id)
      const chatId = update.callback_query.message.chat.id
      const action = update.callback_query.data as string
      await answerCb(token, update.callback_query.id)

      const absenceReasons: Record<string, string> = {
        abs_sick:     '🤒 Kasalman',
        abs_vacation: '🏖️ Dam olyapman',
        abs_busy:     '💼 Ishim bor',
        abs_other:    '✍️ Boshqa sabab',
      }

      if (absenceReasons[action]) {
        const emp = await prisma.employee.findUnique({ where: { telegramId: tgId } })
        if (!emp || !emp.isActive) return NextResponse.json({ ok: true })

        const today = getTashkentDate()
        const reason = absenceReasons[action]

        await prisma.attendance.create({
          data: {
            employeeId: emp.id,
            workDate: today,
            absenceReason: reason,
          },
        })

        await sendMenu(token, chatId,
          `✅ <b>Qayd etildi!</b>\n\n👤 ${emp.name}\n📅 ${today}\n📝 Sabab: ${reason}\n\nTez tuzalib keling! 🙏`)

        if (adminId) {
          await tg(token, 'sendMessage', {
            chat_id: adminId,
            text: `🚫 <b>${emp.name}</b> bugun kelmaydi\n📝 Sabab: ${reason}`,
            parse_mode: 'HTML',
          })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Bot xatosi:', err)
    return NextResponse.json({ ok: true })
  }
}

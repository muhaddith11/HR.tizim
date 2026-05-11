import { prisma } from './prisma'

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Toshkent vaqti UTC+5
export function getTashkentDate(): string {
  const tz = new Date(Date.now() + 5 * 60 * 60 * 1000)
  return tz.toISOString().split('T')[0]
}

export function formatTime(iso: string | Date | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const tz = new Date(d.getTime() + 5 * 60 * 60 * 1000)
  return tz.toISOString().substring(11, 16)
}

type BotConfig = {
  hrBotToken: string | null
  hrAdminChatId: string | null
  officeLat: number | null
  officeLon: number | null
  officeRadius: number
}

// DB sozlamalar + env var fallback
export async function getSettings(): Promise<BotConfig> {
  const db = await prisma.settings.findUnique({ where: { id: 'default' } }).catch(() => null)
  return {
    hrBotToken:    db?.hrBotToken    ?? process.env.BOT_TOKEN    ?? null,
    hrAdminChatId: db?.hrAdminChatId ?? process.env.ADMIN_ID     ?? null,
    officeLat:     db?.officeLat     ?? (process.env.OFFICE_LAT  ? parseFloat(process.env.OFFICE_LAT)  : null),
    officeLon:     db?.officeLon     ?? (process.env.OFFICE_LON  ? parseFloat(process.env.OFFICE_LON)  : null),
    officeRadius:  db?.officeRadius  ?? (process.env.OFFICE_RADIUS ? parseFloat(process.env.OFFICE_RADIUS) : 150),
  }
}

async function tg(token: string, method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

export async function sendMenu(token: string, chatId: number | string, text: string) {
  return tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Keldim', callback_data: 'checkin' },
        { text: '🚪 Ketdim', callback_data: 'checkout' },
      ]],
    },
  })
}

export async function askLocation(token: string, chatId: number | string, text: string) {
  return tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: [[{ text: '📍 Lokatsiya yuborish', request_location: true }]],
      one_time_keyboard: true,
      resize_keyboard: true,
    },
  })
}

export async function sendMsg(token: string, chatId: number | string, text: string) {
  return tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    reply_markup: { remove_keyboard: true },
  })
}

export async function answerCb(token: string, id: string, text = '') {
  return tg(token, 'answerCallbackQuery', { callback_query_id: id, text })
}

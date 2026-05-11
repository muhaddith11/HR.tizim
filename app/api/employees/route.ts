import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({ orderBy: { createdAt: 'desc' } })
    return NextResponse.json(employees)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { telegramId, name, position } = await req.json()
    if (!telegramId || !name) {
      return NextResponse.json({ error: 'telegramId va name majburiy' }, { status: 400 })
    }
    const emp = await prisma.employee.upsert({
      where: { telegramId: String(telegramId) },
      update: { name, position: position || null, isActive: true },
      create: { telegramId: String(telegramId), name, position: position || null },
    })
    return NextResponse.json(emp)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTashkentDate } from '@/lib/bot'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date') || getTashkentDate()
    const records = await prisma.attendance.findMany({
      where: { workDate: date },
      include: { employee: { select: { name: true, position: true } } },
      orderBy: { checkIn: 'asc' },
    })
    return NextResponse.json(records)
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

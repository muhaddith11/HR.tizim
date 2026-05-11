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
    const { phone, name, position } = await req.json()
    if (!phone || !name) {
      return NextResponse.json({ error: 'Telefon va ism majburiy' }, { status: 400 })
    }
    const cleanPhone = phone.replace(/\D/g, '')
    const emp = await prisma.employee.upsert({
      where: { phone: cleanPhone },
      update: { name, position: position || null, isActive: true },
      create: { phone: cleanPhone, name, position: position || null },
    })
    return NextResponse.json(emp)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

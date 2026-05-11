'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Clock, Settings, Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, LogOut, AlertCircle } from 'lucide-react'

type Tab = 'davomat' | 'xodimlar' | 'sozlamalar'

type Employee = {
  id: string
  telegramId: string
  name: string
  position: string | null
  isActive: boolean
}

type AttendanceRow = {
  id: string
  workDate: string
  checkIn: string | null
  checkOut: string | null
  employee: { name: string; position: string | null }
}

function getTodayUz() {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000).toISOString().substring(11, 16)
}

function duration(ci: string | null, co: string | null) {
  if (!ci || !co) return '—'
  const ms = new Date(co).getTime() - new Date(ci).getTime()
  return `${Math.floor(ms / 3600000)}s ${Math.floor((ms % 3600000) / 60000)}d`
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('davomat')
  const [date, setDate] = useState(getTodayUz())
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingA, setLoadingA] = useState(false)
  const [loadingE, setLoadingE] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Add employee
  const [tgId, setTgId] = useState('')
  const [name, setName] = useState('')
  const [pos, setPos] = useState('')
  const [adding, setAdding] = useState(false)

  // Settings
  const [cfg, setCfg] = useState({ hrBotToken: '', hrAdminChatId: '', officeLat: '', officeLon: '', officeRadius: '150' })
  const [savingCfg, setSavingCfg] = useState(false)
  const [appUrl, setAppUrl] = useState('')
  const [hooking, setHooking] = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  const loadAttendance = useCallback(async () => {
    setLoadingA(true)
    try {
      const r = await fetch(`/api/attendance?date=${date}`)
      setAttendance(await r.json())
    } finally { setLoadingA(false) }
  }, [date])

  const loadEmployees = useCallback(async () => {
    setLoadingE(true)
    try {
      const r = await fetch('/api/employees')
      setEmployees(await r.json())
    } finally { setLoadingE(false) }
  }, [])

  const loadSettings = useCallback(async () => {
    const r = await fetch('/api/settings')
    const d = await r.json()
    setCfg({
      hrBotToken: d.hrBotToken ?? '',
      hrAdminChatId: d.hrAdminChatId ?? '',
      officeLat: d.officeLat?.toString() ?? '',
      officeLon: d.officeLon?.toString() ?? '',
      officeRadius: d.officeRadius?.toString() ?? '150',
    })
  }, [])

  useEffect(() => { loadAttendance() }, [loadAttendance])
  useEffect(() => {
    if (tab === 'xodimlar') loadEmployees()
    if (tab === 'sozlamalar') loadSettings()
  }, [tab, loadEmployees, loadSettings])

  async function addEmployee() {
    if (!tgId.trim() || !name.trim()) { showToast('Telegram ID va ism kiriting', false); return }
    setAdding(true)
    try {
      const r = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId: tgId.trim(), name: name.trim(), position: pos.trim() }),
      })
      if (r.ok) { showToast('Xodim qo\'shildi'); setTgId(''); setName(''); setPos(''); loadEmployees() }
      else { const d = await r.json(); showToast(d.error || 'Xatolik', false) }
    } finally { setAdding(false) }
  }

  async function toggleEmp(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: emp.name, position: emp.position, isActive: !emp.isActive }),
    })
    showToast(emp.isActive ? 'Xodim o\'chirildi' : 'Faollashtirildi')
    loadEmployees()
  }

  async function saveSettings() {
    setSavingCfg(true)
    try {
      const r = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      if (r.ok) showToast('Sozlamalar saqlandi')
      else showToast('Xatolik', false)
    } finally { setSavingCfg(false) }
  }

  async function setupWebhook() {
    if (!appUrl.trim()) { showToast('App URL kiriting', false); return }
    setHooking(true)
    try {
      const r = await fetch('/api/setup-webhook', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl }),
      })
      const d = await r.json()
      if (d.ok) showToast('Webhook o\'rnatildi ✓')
      else showToast(d.error || 'Xatolik', false)
    } finally { setHooking(false) }
  }

  const shiftDate = (n: number) => {
    const d = new Date(date); d.setDate(d.getDate() + n)
    setDate(d.toISOString().split('T')[0])
  }

  const present = attendance.filter(a => a.checkIn && !a.checkOut).length
  const left = attendance.filter(a => a.checkOut).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            HR Tizim
          </div>
          <nav className="flex gap-1">
            {([
              ['davomat', 'Davomat', <Clock key="c" className="w-4 h-4" />],
              ['xodimlar', 'Xodimlar', <Users key="u" className="w-4 h-4" />],
              ['sozlamalar', 'Sozlamalar', <Settings key="s" className="w-4 h-4" />],
            ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${tab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>
                {icon}<span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* DAVOMAT */}
        {tab === 'davomat' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => shiftDate(1)} disabled={date >= getTodayUz()}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={loadAttendance} disabled={loadingA}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingA ? 'animate-spin' : ''}`} /> Yangilash
              </button>
              <div className="ml-auto flex gap-2 text-sm">
                <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-medium">✅ Ishda: {present}</span>
                <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">🚪 Ketdi: {left}</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-3">Xodim</th>
                    <th className="text-left px-4 py-3">Lavozim</th>
                    <th className="text-left px-4 py-3">Keldi</th>
                    <th className="text-left px-4 py-3">Ketdi</th>
                    <th className="text-left px-4 py-3">Ishladi</th>
                    <th className="text-left px-4 py-3">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingA ? (
                    <tr><td colSpan={6} className="text-center py-16 text-slate-400">Yuklanmoqda...</td></tr>
                  ) : attendance.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-16 text-slate-400">Bu kun uchun ma'lumot yo'q</td></tr>
                  ) : attendance.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{a.employee.name}</td>
                      <td className="px-4 py-3 text-slate-500">{a.employee.position || '—'}</td>
                      <td className="px-4 py-3 font-mono text-green-700">{fmt(a.checkIn)}</td>
                      <td className="px-4 py-3 font-mono text-blue-700">{fmt(a.checkOut)}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{duration(a.checkIn, a.checkOut)}</td>
                      <td className="px-4 py-3">
                        {!a.checkIn ? (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Kelmagan</span>
                        ) : !a.checkOut ? (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" /> Ishda
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full flex items-center gap-1 w-fit">
                            <LogOut className="w-3 h-3" /> Ketdi
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* XODIMLAR */}
        {tab === 'xodimlar' && (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Yangi xodim</h2>
              <p className="text-xs text-slate-500 mb-3">
                Telegram ID olish: xodim botga <code className="bg-slate-100 px-1 rounded">/start</code> yuborgandan so'ng
                siz <code className="bg-slate-100 px-1 rounded">@userinfobot</code> ga uning xabarini forward qiling.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Telegram ID *</label>
                  <input value={tgId} onChange={e => setTgId(e.target.value)} placeholder="123456789"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Ism familiya *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Abdullayev Ali"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Lavozim</label>
                  <input value={pos} onChange={e => setPos(e.target.value)} placeholder="Kassir"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button onClick={addEmployee} disabled={adding}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                <Plus className="w-4 h-4" /> {adding ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h2 className="font-semibold">Xodimlar ro'yxati</h2>
                <button onClick={loadEmployees} disabled={loadingE}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs hover:bg-slate-50">
                  <RefreshCw className={`w-3 h-3 ${loadingE ? 'animate-spin' : ''}`} /> Yangilash
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">Ism</th>
                    <th className="text-left px-4 py-2.5">Lavozim</th>
                    <th className="text-left px-4 py-2.5">Telegram ID</th>
                    <th className="text-left px-4 py-2.5">Holat</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingE ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">Yuklanmoqda...</td></tr>
                  ) : employees.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">Xodimlar yo'q</td></tr>
                  ) : employees.map(emp => (
                    <tr key={emp.id} className={`hover:bg-slate-50 ${!emp.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{emp.name}</td>
                      <td className="px-4 py-3 text-slate-500">{emp.position || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{emp.telegramId}</td>
                      <td className="px-4 py-3">
                        {emp.isActive
                          ? <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Faol</span>
                          : <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">Nofaol</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => toggleEmp(emp)}
                          className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border ml-auto
                            ${emp.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}>
                          <Trash2 className="w-3 h-3" />
                          {emp.isActive ? "O'chirish" : 'Faollashtirish'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* SOZLAMALAR */}
        {tab === 'sozlamalar' && (
          <div className="space-y-4">
            {/* Bot token */}
            <div className="bg-white rounded-xl border border-blue-200 p-5">
              <h2 className="font-semibold text-blue-700 mb-1">🤖 Telegram Bot</h2>
              <p className="text-xs text-slate-500 mb-4">
                @BotFather orqali yangi bot yarating. Bu faqat HR uchun alohida bot.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Bot Token</label>
                  <input type="password" value={cfg.hrBotToken}
                    onChange={e => setCfg({ ...cfg, hrBotToken: e.target.value })}
                    placeholder="123456789:ABCDefgh..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Admin Telegram ID</label>
                  <input value={cfg.hrAdminChatId}
                    onChange={e => setCfg({ ...cfg, hrAdminChatId: e.target.value })}
                    placeholder="12345678"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-slate-400 mt-1">Keldi/ketdi xabarlari shu ID ga keladi. /bugun → bugungi hisobot</p>
                </div>
              </div>
              <button onClick={saveSettings} disabled={savingCfg}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {savingCfg ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>

            {/* Office location */}
            <div className="bg-white rounded-xl border border-green-200 p-5">
              <h2 className="font-semibold text-green-700 mb-1">📍 Ishxona Lokatsiyasi</h2>
              <p className="text-xs text-slate-500 mb-4">
                Faqat shu koordinatlar atrofida xodimlar belgilay oladi.
                Google Maps dan: sichqoncha o'ng tugma → koordinatlarni nusxalash.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Kenglik (Latitude)</label>
                  <input value={cfg.officeLat} onChange={e => setCfg({ ...cfg, officeLat: e.target.value })}
                    placeholder="41.2995"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Uzunlik (Longitude)</label>
                  <input value={cfg.officeLon} onChange={e => setCfg({ ...cfg, officeLon: e.target.value })}
                    placeholder="69.2401"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Ruxsat etilgan radius (metr)</label>
                <input type="number" value={cfg.officeRadius}
                  onChange={e => setCfg({ ...cfg, officeRadius: e.target.value })}
                  placeholder="150"
                  className="w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <p className="text-xs text-slate-400 mt-1">Tavsiya: 100–200 metr. Kichikroq = qattiqroq nazorat.</p>
              </div>
              <button onClick={saveSettings} disabled={savingCfg}
                className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                {savingCfg ? 'Saqlanmoqda...' : 'Lokatsiyani saqlash'}
              </button>
            </div>

            {/* Webhook */}
            <div className="bg-white rounded-xl border border-orange-200 p-5">
              <h2 className="font-semibold text-orange-700 mb-1">🔗 Webhook O'rnatish</h2>
              <p className="text-xs text-slate-500 mb-4">
                Bot tokenini saqlagandan keyin bir marta webhook o'rnating.
                Deploy qilingan saytingizning URL ini kiriting.
              </p>
              <div className="flex gap-2">
                <input value={appUrl} onChange={e => setAppUrl(e.target.value)}
                  placeholder="https://sizning-saytingiz.vercel.app"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <button onClick={setupWebhook} disabled={hooking}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-60 whitespace-nowrap">
                  {hooking ? 'O\'rnatilmoqda...' : 'O\'rnatish'}
                </button>
              </div>
            </div>

            {/* Bot commands */}
            <div className="bg-slate-100 rounded-xl p-4 text-sm">
              <p className="font-medium mb-2 text-slate-700">Bot buyruqlari (admin uchun)</p>
              <div className="space-y-1 font-mono text-slate-600 text-xs">
                <p><span className="text-blue-600">/bugun</span> — bugungi davomat hisoboti</p>
                <p><span className="text-blue-600">/xodimlar</span> — xodimlar ro'yxati</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg text-white
          ${toast.ok ? 'bg-green-600' : 'bg-red-500'}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

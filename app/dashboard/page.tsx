'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, Clock, Settings, Plus, Trash2, RefreshCw, ChevronLeft, ChevronRight, LogOut, MapPin, Bot, Shield, Pencil, X, Check } from 'lucide-react'

type Tab = 'davomat' | 'xodimlar' | 'sozlamalar'
type Employee = { id: string; phone: string; telegramId: string | null; name: string; position: string | null; isActive: boolean }
type AttendanceRow = { id: string; workDate: string; checkIn: string | null; checkOut: string | null; isLate: boolean; employee: { name: string; position: string | null } }

function getTodayUz() {
  return new Date(Date.now() + 5 * 3600000).toISOString().split('T')[0]
}
function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(new Date(iso).getTime() + 5 * 3600000).toISOString().substring(11, 16)
}
function duration(ci: string | null, co: string | null) {
  if (!ci || !co) return '—'
  const ms = new Date(co).getTime() - new Date(ci).getTime()
  return `${Math.floor(ms / 3600000)}s ${Math.floor((ms % 3600000) / 60000)}d`
}
function lateDuration(ci: string | null) {
  if (!ci) return ''
  const d = new Date(new Date(ci).getTime() + 5 * 3600000)
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes() - (9 * 60 + 30)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}s ${m}d kech` : `${m}d kech`
}
function formatPhone(p: string) {
  if (p.length === 12) return `+${p.slice(0, 3)} ${p.slice(3, 5)} ${p.slice(5, 8)} ${p.slice(8, 10)} ${p.slice(10)}`
  if (p.length === 9) return `+998 ${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5, 7)} ${p.slice(7)}`
  return p
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('davomat')
  const [date, setDate] = useState(getTodayUz())
  const [attendance, setAttendance] = useState<AttendanceRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loadingA, setLoadingA] = useState(false)
  const [loadingE, setLoadingE] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [pos, setPos] = useState('')
  const [adding, setAdding] = useState(false)

  // Edit state
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editPos, setEditPos] = useState('')
  const [saving, setSaving] = useState(false)

  const [cfg, setCfg] = useState({ hrBotToken: '', hrAdminChatId: '', officeLat: '', officeLon: '', officeRadius: '100' })
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
      const data = await r.json()
      setAttendance(Array.isArray(data) ? data : [])
    } finally { setLoadingA(false) }
  }, [date])

  const loadEmployees = useCallback(async () => {
    setLoadingE(true)
    try { const r = await fetch('/api/employees'); setEmployees(await r.json()) }
    finally { setLoadingE(false) }
  }, [])

  const loadSettings = useCallback(async () => {
    const r = await fetch('/api/settings'); const d = await r.json()
    setCfg({ hrBotToken: d.hrBotToken ?? '', hrAdminChatId: d.hrAdminChatId ?? '', officeLat: d.officeLat?.toString() ?? '', officeLon: d.officeLon?.toString() ?? '', officeRadius: d.officeRadius?.toString() ?? '100' })
  }, [])

  useEffect(() => { loadAttendance() }, [loadAttendance])
  useEffect(() => {
    if (tab === 'xodimlar') loadEmployees()
    if (tab === 'sozlamalar') loadSettings()
  }, [tab, loadEmployees, loadSettings])

  async function addEmployee() {
    if (!phone.trim() || !name.trim()) { showToast('Telefon va ism kiriting', false); return }
    setAdding(true)
    try {
      const r = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: phone.trim(), name: name.trim(), position: pos.trim() }) })
      if (r.ok) { showToast("Xodim qo'shildi ✓"); setPhone(''); setName(''); setPos(''); loadEmployees() }
      else { const d = await r.json(); showToast(d.error || 'Xatolik', false) }
    } finally { setAdding(false) }
  }

  function openEdit(emp: Employee) {
    setEditEmp(emp)
    setEditName(emp.name)
    setEditPhone(emp.phone)
    setEditPos(emp.position ?? '')
  }

  async function saveEdit() {
    if (!editEmp || !editName.trim()) { showToast('Ism kiriting', false); return }
    setSaving(true)
    try {
      const r = await fetch(`/api/employees/${editEmp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), position: editPos.trim() || null, phone: editPhone.trim() }),
      })
      if (r.ok) { showToast('Saqlandi ✓'); setEditEmp(null); loadEmployees() }
      else { const d = await r.json(); showToast(d.error || 'Xatolik', false) }
    } finally { setSaving(false) }
  }

  async function toggleEmp(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !emp.isActive }) })
    showToast(emp.isActive ? "O'chirildi" : 'Faollashtirildi')
    loadEmployees()
  }

  async function saveSettings() {
    setSavingCfg(true)
    try {
      const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
      if (r.ok) showToast('Saqlandi ✓'); else showToast('Xatolik', false)
    } finally { setSavingCfg(false) }
  }

  async function setupWebhook() {
    if (!appUrl.trim()) { showToast('URL kiriting', false); return }
    setHooking(true)
    try {
      const r = await fetch('/api/setup-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appUrl }) })
      const d = await r.json()
      if (d.ok) showToast('Webhook ulandi ✓'); else showToast(d.error || 'Xatolik', false)
    } finally { setHooking(false) }
  }

  const shiftDate = (n: number) => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(d.toISOString().split('T')[0]) }
  const present = attendance.filter(a => a.checkIn && !a.checkOut).length
  const left = attendance.filter(a => a.checkOut).length
  const lateCount = attendance.filter(a => a.isLate).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white">

      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-16 md:w-56 bg-slate-900/80 backdrop-blur border-r border-white/5 flex flex-col z-20">
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <span className="font-bold text-sm hidden md:block">HR Tizim</span>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {([
            ['davomat', 'Davomat', <Clock key="c" className="w-5 h-5" />],
            ['xodimlar', 'Xodimlar', <Users key="u" className="w-5 h-5" />],
            ['sozlamalar', 'Sozlamalar', <Settings key="s" className="w-5 h-5" />],
          ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${tab === id ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              {icon}
              <span className="hidden md:block">{label}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 hidden md:block">
          <div className="text-xs text-slate-600 text-center">v1.1.0</div>
        </div>
      </div>

      {/* Main */}
      <div className="ml-16 md:ml-56 min-h-screen">

        {/* DAVOMAT */}
        {tab === 'davomat' && (
          <div className="p-6 space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Davomat</h1>
              <p className="text-slate-400 text-sm">Kunlik xodimlar davomati</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Jami', val: attendance.length, color: 'bg-slate-800 border-slate-700' },
                { label: 'Ishda', val: present, color: 'bg-emerald-900/40 border-emerald-700/40' },
                { label: 'Ketdi', val: left, color: 'bg-blue-900/40 border-blue-700/40' },
                { label: 'Kechikdi', val: lateCount, color: 'bg-amber-900/40 border-amber-700/40' },
              ].map(s => (
                <div key={s.label} className={`${s.color} border rounded-2xl p-4`}>
                  <div className="text-3xl font-bold">{s.val}</div>
                  <div className="text-sm text-slate-400 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => shiftDate(-1)} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
              <button onClick={() => shiftDate(1)} disabled={date >= getTodayUz()}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={loadAttendance} disabled={loadingA}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/5 text-sm transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingA ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Yangilash</span>
              </button>
            </div>

            <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden backdrop-blur">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3.5">Xodim</th>
                    <th className="text-left px-5 py-3.5 hidden sm:table-cell">Lavozim</th>
                    <th className="text-left px-5 py-3.5">Keldi</th>
                    <th className="text-left px-5 py-3.5">Ketdi</th>
                    <th className="text-left px-5 py-3.5 hidden md:table-cell">Ishladi</th>
                    <th className="text-left px-5 py-3.5">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingA ? (
                    <tr><td colSpan={6} className="text-center py-16 text-slate-500">Yuklanmoqda...</td></tr>
                  ) : attendance.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-16 text-slate-500">Bu kun uchun ma&apos;lumot yo&apos;q</td></tr>
                  ) : attendance.map(a => {
                    const late = lateDuration(a.checkIn)
                    return (
                      <tr key={a.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="px-5 py-3.5 font-medium">{a.employee.name}</td>
                        <td className="px-5 py-3.5 text-slate-400 hidden sm:table-cell">{a.employee.position || '—'}</td>
                        <td className="px-5 py-3.5">
                          <span className={`font-mono ${a.isLate ? 'text-amber-400' : 'text-emerald-400'}`}>{fmt(a.checkIn)}</span>
                          {a.isLate && late && <span className="ml-1.5 text-xs text-amber-500">+{late}</span>}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-blue-400">{fmt(a.checkOut)}</td>
                        <td className="px-5 py-3.5 font-mono text-slate-400 hidden md:table-cell">{duration(a.checkIn, a.checkOut)}</td>
                        <td className="px-5 py-3.5">
                          {!a.checkIn ? (
                            <span className="text-xs px-2.5 py-1 bg-slate-700 text-slate-400 rounded-full">Kelmagan</span>
                          ) : a.isLate && !a.checkOut ? (
                            <span className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-400 rounded-full border border-amber-500/30">⚠ Kechikdi</span>
                          ) : !a.checkOut ? (
                            <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">● Ishda</span>
                          ) : a.isLate ? (
                            <span className="text-xs px-2.5 py-1 bg-amber-900/40 text-amber-400 rounded-full flex items-center gap-1 w-fit">
                              <LogOut className="w-3 h-3" />Kechikib ketdi
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 bg-slate-700 text-slate-400 rounded-full flex items-center gap-1 w-fit">
                              <LogOut className="w-3 h-3" />Ketdi
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* XODIMLAR */}
        {tab === 'xodimlar' && (
          <div className="p-6 space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Xodimlar</h1>
              <p className="text-slate-400 text-sm">Xodimlarni boshqarish</p>
            </div>

            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 backdrop-blur">
              <h2 className="font-semibold mb-1 flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-400" />Yangi xodim</h2>
              <p className="text-xs text-slate-500 mb-4">
                Xodim botga <code className="bg-slate-800 px-1.5 py-0.5 rounded">/start</code> bosadi → telefon raqamini ulashadi → tizimga kiradi
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Telefon raqam *</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998901234567"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Ism familiya *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Abdullayev Ali"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Lavozim</label>
                  <input value={pos} onChange={e => setPos(e.target.value)} placeholder="Kassir"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600" />
                </div>
              </div>
              <button onClick={addEmployee} disabled={adding}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                <Plus className="w-4 h-4" />{adding ? "Qo'shilmoqda..." : "Qo'shish"}
              </button>
            </div>

            <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden backdrop-blur">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <span className="font-semibold">Ro&apos;yxat</span>
                <button onClick={loadEmployees} disabled={loadingE}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs transition-colors">
                  <RefreshCw className={`w-3 h-3 ${loadingE ? 'animate-spin' : ''}`} />Yangilash
                </button>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Ism</th>
                    <th className="text-left px-5 py-3 hidden sm:table-cell">Telefon</th>
                    <th className="text-left px-5 py-3 hidden md:table-cell">Lavozim</th>
                    <th className="text-left px-5 py-3">Bot</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingE ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-500">Yuklanmoqda...</td></tr>
                  ) : employees.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-slate-500">Xodimlar yo&apos;q</td></tr>
                  ) : employees.map(emp => (
                    <tr key={emp.id} className={`hover:bg-white/[0.03] transition-colors ${!emp.isActive ? 'opacity-40' : ''}`}>
                      <td className="px-5 py-3.5 font-medium">{emp.name}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-400 text-xs hidden sm:table-cell">{formatPhone(emp.phone)}</td>
                      <td className="px-5 py-3.5 text-slate-400 hidden md:table-cell">{emp.position || '—'}</td>
                      <td className="px-5 py-3.5">
                        {emp.telegramId
                          ? <span className="text-xs px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">✓ Ulangan</span>
                          : <span className="text-xs px-2.5 py-1 bg-slate-700 text-slate-500 rounded-full">Kutilmoqda</span>
                        }
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(emp)}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 transition-colors">
                            <Pencil className="w-3 h-3" />Tahrir
                          </button>
                          <button onClick={() => toggleEmp(emp)}
                            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors
                              ${emp.isActive ? 'border-red-500/30 text-red-400 hover:bg-red-500/10' : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'}`}>
                            <Trash2 className="w-3 h-3" />{emp.isActive ? "O'chirish" : 'Faollashtirish'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SOZLAMALAR */}
        {tab === 'sozlamalar' && (
          <div className="p-6 space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Sozlamalar</h1>
              <p className="text-slate-400 text-sm">Bot va ishxona konfiguratsiyasi</p>
            </div>

            <div className="bg-slate-900/60 border border-indigo-500/20 rounded-2xl p-5 backdrop-blur">
              <h2 className="font-semibold mb-1 flex items-center gap-2 text-indigo-300"><Bot className="w-4 h-4" />Telegram Bot</h2>
              <p className="text-xs text-slate-500 mb-4">@BotFather orqali yaratilgan bot tokeni</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Bot Token</label>
                  <input type="password" value={cfg.hrBotToken} onChange={e => setCfg({ ...cfg, hrBotToken: e.target.value })}
                    placeholder="123456789:ABCDefgh..."
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Admin Telegram ID</label>
                  <input value={cfg.hrAdminChatId} onChange={e => setCfg({ ...cfg, hrAdminChatId: e.target.value })}
                    placeholder="12345678"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              <button onClick={saveSettings} disabled={savingCfg}
                className="mt-4 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                {savingCfg ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>

            <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-5 backdrop-blur">
              <h2 className="font-semibold mb-1 flex items-center gap-2 text-emerald-300"><MapPin className="w-4 h-4" />Ishxona Lokatsiyasi</h2>
              <p className="text-xs text-slate-500 mb-4">Google Maps → sichqoncha o&apos;ng tugma → koordinatlarni nusxalash</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Kenglik (Latitude)</label>
                  <input value={cfg.officeLat} onChange={e => setCfg({ ...cfg, officeLat: e.target.value })} placeholder="41.2995"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">Uzunlik (Longitude)</label>
                  <input value={cfg.officeLon} onChange={e => setCfg({ ...cfg, officeLon: e.target.value })} placeholder="69.2401"
                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Radius (metr)</label>
                <input type="number" value={cfg.officeRadius} onChange={e => setCfg({ ...cfg, officeRadius: e.target.value })}
                  className="w-36 bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-emerald-500 transition-colors" />
              </div>
              <button onClick={saveSettings} disabled={savingCfg}
                className="mt-4 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                {savingCfg ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>

            <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-5 backdrop-blur">
              <h2 className="font-semibold mb-1 flex items-center gap-2 text-amber-300"><Shield className="w-4 h-4" />Webhook</h2>
              <p className="text-xs text-slate-500 mb-4">Saytingiz URL ini kiriting va webhook ulang</p>
              <div className="flex gap-2">
                <input value={appUrl} onChange={e => setAppUrl(e.target.value)} placeholder="https://hr-tizim.vercel.app"
                  className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors" />
                <button onClick={setupWebhook} disabled={hooking}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap">
                  {hooking ? '...' : "Ulash"}
                </button>
              </div>
            </div>

            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4">
              <p className="text-xs font-medium text-slate-400 mb-2">Bot buyruqlari (admin uchun)</p>
              <div className="space-y-1 font-mono text-xs text-slate-500">
                <p><span className="text-indigo-400">/bugun</span> — bugungi davomat</p>
                <p><span className="text-indigo-400">/xodimlar</span> — xodimlar ro&apos;yxati</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editEmp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">Xodimni tahrirlash</h2>
              <button onClick={() => setEditEmp(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Ism familiya *</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Telefon raqam</label>
                <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Lavozim</label>
                <input value={editPos} onChange={e => setEditPos(e.target.value)} placeholder="Kassir"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditEmp(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:bg-white/5 text-sm transition-colors">
                Bekor
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors disabled:opacity-50">
                <Check className="w-4 h-4" />{saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl border transition-all z-50
          ${toast.ok ? 'bg-emerald-900 border-emerald-700 text-emerald-200' : 'bg-red-900 border-red-700 text-red-200'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BarChart3, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, CreditCard, Home, Landmark, LogOut, Menu, Plus, Settings, Target, Trash2, TrendingUp, Wallet, X } from 'lucide-react'
import {
  categories as defaultCategories,
  defaultCategoryGroups,
  type CategoryGroups,
  money,
  monthKey,
  parseMoney,
  type Account,
  type AccountItem,
  type Budget,
  type MonthlyData,
  type Transaction,
  type TransactionType,
  type RecurringFixedExpense,
  parseTransactionText,
  getUserProfile,
  saveUserProfile,
  loadUserDataFromFirestore,
  saveUserDataToFirestore,
  loadAccountsFromFirestore,
  saveAccountsToFirestore,
  loadUserSettingsFromFirestore,
  saveUserSettingsToFirestore,
  type ProfitFirstAccount,
  type ProfitFirstMonth,
  defaultProfitFirstAccounts,
  loadProfitFirstFromFirestore,
  saveProfitFirstToFirestore
} from '@/lib/firestore'

type Page = 'dashboard' | 'calendar' | 'budget' | 'transactions' | 'accounts' | 'annual' | 'profit_first' | 'settings'

const typeLabel: Record<TransactionType, string> = {
  income: '수입',
  fixed_expense: '고정지출',
  variable_expense: '변동지출',
  saving: '저축',
  loan_payment: '대출상환'
}

const typeColor: Record<TransactionType, string> = {
  income: 'text-income',
  fixed_expense: 'text-expense',
  variable_expense: 'text-expense',
  saving: 'text-primary',
  loan_payment: 'text-warning'
}

const ymLabel = (ym: string) => {
  const [y, m] = ym.split('-')
  return `${y}년 ${Number(m)}월`
}

const uid = () => Math.random().toString(36).slice(2, 9)

function AuthScreen({ onLogin }: { onLogin: (phone: string) => void }) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [autoLogin, setAutoLogin] = useState(true)
  const [error, setError] = useState('')

  const formatPhone = (val: string) => {
    const nums = val.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 3) return nums
    if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`
    return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`
  }

  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      setError('올바른 핸드폰 번호를 입력해주세요.')
      return
    }
    if (!password) {
      setError('비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const users: Record<string, { password?: string; name?: string }> = JSON.parse(localStorage.getItem('sobinote-users') || '{}')
      const cloudUser = await getUserProfile(cleanPhone)

      const targetPw = cloudUser?.password || users[cleanPhone]?.password

      if (targetPw) {
        if (targetPw !== password) {
          setError('비밀번호가 맞지 않아요.')
          setLoading(false)
          return
        }
      } else {
        if (password !== '1234') {
          setError('처음이시라면 초기 비밀번호 1234를 입력해주세요.')
          setLoading(false)
          return
        }
        await saveUserProfile(cleanPhone, { password: '1234' })
        users[cleanPhone] = { password: '1234' }
        localStorage.setItem('sobinote-users', JSON.stringify(users))
      }

      if (cloudUser) {
        users[cleanPhone] = { ...users[cleanPhone], ...cloudUser }
        localStorage.setItem('sobinote-users', JSON.stringify(users))
      }

      if (autoLogin) {
        localStorage.setItem('sobinote-session', JSON.stringify({ phone: cleanPhone }))
      } else {
        localStorage.removeItem('sobinote-session')
      }

      onLogin(cleanPhone)
    } catch {
      setError('로그인 처리 중 오류가 발생했어요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-mark">
        <div className="brand-icon"><Wallet /></div>
        <div className="brand-text">
          <span className="brand-sub">사명가의</span>
          <span className="brand-main">소비노트</span>
        </div>
      </div>
      <section className="auth-card">
        <p className="eyebrow">나의 돈을 돌보는 가장 쉬운 방법</p>
        <h1>사명가의 소비노트에 오신 것을 환영해요</h1>
        <p className="muted">핸드폰 번호로 간편하게 시작하세요.</p>
        <form onSubmit={submit} className="form-stack">
          <label>핸드폰 번호
            <input
              type="tel"
              required
              placeholder="010-1234-5678"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              inputMode="numeric"
            />
          </label>
          <label>비밀번호
            <input
              type="password"
              required
              placeholder="초기 비밀번호: 1234"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
          <label className="auto-login-label">
            <input
              type="checkbox"
              checked={autoLogin}
              onChange={e => setAutoLogin(e.target.checked)}
            />
            <span>자동 로그인</span>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary-btn" type="submit">
            로그인하기<ArrowUp />
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1rem', fontSize: '0.78rem', textAlign: 'center' }}>
          처음 오셨나요? 핸드폰 번호와 초기 비밀번호 <b>1234</b>로 시작하세요.
        </p>
      </section>
      <p className="auth-foot">안전하게, 스마트하게 관리하는 개인 가계부</p>
    </main>
  )
}

function StatCard({ title, value, caption, tone, icon: Icon }: { title: string; value: number; caption: string; tone: string; icon: typeof Wallet }) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{title}</span>
        <Icon />
      </div>
      <strong>{money(value)}</strong>
      <small>{caption}</small>
    </div>
  )
}

function Donut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((a, b) => a + b.value, 0) || 1
  let offset = 0
  const colors = ['#0071e3', '#34c759', '#ff9500', '#af52de', '#5856d6']
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 42 42" className="donut">
        <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--line)" strokeWidth="5" />
        {data.map((d, i) => {
          const dash = (d.value / total) * 100
          const el = (
            <circle
              key={d.name}
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="5"
              strokeDasharray={`${dash} ${100 - dash}`}
              strokeDashoffset={25 - offset}
            />
          )
          offset += dash
          return el
        })}
      </svg>
      <div className="donut-center">
        <strong>{money(total).replace('원', '')}</strong>
        <span>사용금액</span>
      </div>
      <div className="legend">
        {data.map((d, i) => (
          <span key={d.name}>
            <i style={{ background: colors[i % colors.length] }} />
            {d.name.replace('/', '·')} <b>{Math.round((d.value / total) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Page() {
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [page, setPage] = useState<Page>('dashboard')
  const [month, setMonth] = useState(monthKey())
  const [data, setData] = useState<MonthlyData>({ transactions: [], budgets: [], expectedIncome: 0 })
  const [accounts, setAccounts] = useState<Account[]>([])
  const [catGroups, setCatGroups] = useState<CategoryGroups>(defaultCategoryGroups)
  const cats = catGroups.expense
  const [recurringFixed, setRecurringFixed] = useState<RecurringFixedExpense[]>([])
  const [modal, setModal] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined)
  const [modalDefaultType, setModalDefaultType] = useState<TransactionType | undefined>(undefined)
  const [modalDefaultCategory, setModalDefaultCategory] = useState<string | undefined>(undefined)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [accountModal, setAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [itemModalAccount, setItemModalAccount] = useState<Account | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [profitFirstMonths, setProfitFirstMonths] = useState<ProfitFirstMonth[]>([])

  const persistProfitFirst = (next: ProfitFirstMonth[]) => {
    setProfitFirstMonths(next)
    if (currentUser) {
      localStorage.setItem(`sobinote-profitfirst-${currentUser}`, JSON.stringify(next))
      saveProfitFirstToFirestore(currentUser, next)
    }
  }

  const persistCatGroups = (next: CategoryGroups) => {
    setCatGroups(next)
    if (currentUser) {
      localStorage.setItem(`sobinote-cat-groups-${currentUser}`, JSON.stringify(next))
      saveUserSettingsToFirestore(currentUser, { catGroups: next, recurringFixed })
    }
  }

  const persistRecurringFixed = (next: RecurringFixedExpense[]) => {
    setRecurringFixed(next)
    if (currentUser) {
      localStorage.setItem(`sobinote-recurring-fixed-${currentUser}`, JSON.stringify(next))
      saveUserSettingsToFirestore(currentUser, { catGroups, recurringFixed: next })
    }
  }

  const setCats = (nextExpense: string[]) => {
    persistCatGroups({ ...catGroups, expense: nextExpense })
  }

  const sanitizeData = (raw: any): MonthlyData => ({
    expectedIncome: Number(raw?.expectedIncome) || 0,
    budgets: Array.isArray(raw?.budgets) ? raw.budgets : [],
    transactions: Array.isArray(raw?.transactions) ? raw.transactions : [],
    savingGoal: raw?.savingGoal || '',
    praisePoints: raw?.praisePoints || '',
    reflectionPoints: raw?.reflectionPoints || '',
    wishList: raw?.wishList || '',
    consumptionGoal: raw?.consumptionGoal || '',
    weeklyFeedback: raw?.weeklyFeedback || {}
  })

  const loadUserData = async (phone: string) => {
    // 1. First load from local storage for instant responsiveness
    const savedData = localStorage.getItem(`sobinote-data-${phone}`)
    if (savedData) {
      try {
        setData(sanitizeData(JSON.parse(savedData)))
      } catch {
        setData({ transactions: [], budgets: [], expectedIncome: 0 })
      }
    } else {
      setData({ transactions: [], budgets: [], expectedIncome: 0 })
    }

    const savedAccounts = localStorage.getItem(`sobinote-accounts-${phone}`)
    if (savedAccounts) {
      try {
        const parsed = JSON.parse(savedAccounts)
        setAccounts(Array.isArray(parsed) ? parsed : [])
      } catch {
        setAccounts([])
      }
    } else {
      setAccounts([])
    }

    const savedCatGroups = localStorage.getItem(`sobinote-cat-groups-${phone}`)
    if (savedCatGroups) {
      try {
        setCatGroups(JSON.parse(savedCatGroups))
      } catch {
        setCatGroups(defaultCategoryGroups)
      }
    } else {
      const savedCats = localStorage.getItem(`sobinote-cats-${phone}`)
      if (savedCats) {
        try {
          setCatGroups({ ...defaultCategoryGroups, expense: JSON.parse(savedCats) })
        } catch {
          setCatGroups(defaultCategoryGroups)
        }
      } else {
        setCatGroups(defaultCategoryGroups)
      }
    }

    const savedRecurring = localStorage.getItem(`sobinote-recurring-fixed-${phone}`)
    if (savedRecurring) {
      try {
        const parsed = JSON.parse(savedRecurring)
        setRecurringFixed(Array.isArray(parsed) ? parsed : [])
      } catch {
        setRecurringFixed([])
      }
    } else {
      setRecurringFixed([])
    }

    const savedProfitFirst = localStorage.getItem(`sobinote-profitfirst-${phone}`)
    if (savedProfitFirst) {
      try {
        const parsed = JSON.parse(savedProfitFirst)
        setProfitFirstMonths(Array.isArray(parsed) ? parsed : [])
      } catch {
        setProfitFirstMonths([])
      }
    } else {
      setProfitFirstMonths([])
    }

    const users: Record<string, { password?: string; name?: string }> = JSON.parse(localStorage.getItem('sobinote-users') || '{}')
    setUserName(users[phone]?.name || '')

    // 2. Fetch from Firestore to sync latest across devices
    try {
      const [cloudData, cloudAccounts, cloudProfile, cloudSettings, cloudProfitFirst] = await Promise.all([
        loadUserDataFromFirestore(phone),
        loadAccountsFromFirestore(phone),
        getUserProfile(phone),
        loadUserSettingsFromFirestore(phone),
        loadProfitFirstFromFirestore(phone)
      ])

      if (cloudData) {
        const clean = sanitizeData(cloudData)
        setData(clean)
        localStorage.setItem(`sobinote-data-${phone}`, JSON.stringify(clean))
      }
      if (cloudAccounts) {
        const cleanAccounts = Array.isArray(cloudAccounts) ? cloudAccounts : []
        setAccounts(cleanAccounts)
        localStorage.setItem(`sobinote-accounts-${phone}`, JSON.stringify(cleanAccounts))
      }
      if (cloudProfile) {
        if (cloudProfile.name) setUserName(cloudProfile.name)
        users[phone] = { ...users[phone], ...cloudProfile }
        localStorage.setItem('sobinote-users', JSON.stringify(users))
      }
      if (cloudSettings) {
        if (cloudSettings.catGroups) {
          setCatGroups(cloudSettings.catGroups)
          localStorage.setItem(`sobinote-cat-groups-${phone}`, JSON.stringify(cloudSettings.catGroups))
        }
        if (cloudSettings.recurringFixed && Array.isArray(cloudSettings.recurringFixed)) {
          setRecurringFixed(cloudSettings.recurringFixed)
          localStorage.setItem(`sobinote-recurring-fixed-${phone}`, JSON.stringify(cloudSettings.recurringFixed))
        }
      }
      if (cloudProfitFirst) {
        const cleanPF = Array.isArray(cloudProfitFirst) ? cloudProfitFirst : []
        setProfitFirstMonths(cleanPF)
        localStorage.setItem(`sobinote-profitfirst-${phone}`, JSON.stringify(cleanPF))
      }
    } catch (e) {
      console.error('Cloud sync error on load:', e)
    }
  }

  // Auto-login check
  useEffect(() => {
    const session = localStorage.getItem('sobinote-session')
    if (session) {
      try {
        const { phone } = JSON.parse(session)
        if (phone) {
          setCurrentUser(phone)
          loadUserData(phone)
        }
      } catch { /* ignore invalid session */ }
    }
  }, [])

  const persist = (next: MonthlyData) => {
    const clean = sanitizeData(next)
    setData(clean)
    if (currentUser) {
      localStorage.setItem(`sobinote-data-${currentUser}`, JSON.stringify(clean))
      saveUserDataToFirestore(currentUser, clean)
    }
  }

  const persistAccounts = (next: Account[]) => {
    const clean = Array.isArray(next) ? next : []
    setAccounts(clean)
    if (currentUser) {
      localStorage.setItem(`sobinote-accounts-${currentUser}`, JSON.stringify(clean))
      saveAccountsToFirestore(currentUser, clean)
    }
  }

  const totals = useMemo(() => {
    const tx = Array.isArray(data?.transactions) ? data.transactions : []
    const sum = (t: TransactionType) => tx.filter(x => x.type === t).reduce((a, x) => a + (Number(x.amount) || 0), 0)
    return {
      income: sum('income'),
      fixed: sum('fixed_expense'),
      variable: sum('variable_expense'),
      saving: sum('saving'),
      loan: sum('loan_payment')
    }
  }, [data])

  const budgetTotals = useMemo(() => {
    const b = Array.isArray(data?.budgets) ? data.budgets : []
    return {
      fixed: b.filter(x => x.section === 'fixed').reduce((a, x) => a + (Number(x.amount) || 0), 0),
      variable: b.filter(x => x.section === 'variable').reduce((a, x) => a + (Number(x.amount) || 0), 0),
      saving: b.filter(x => x.section === 'saving').reduce((a, x) => a + (Number(x.amount) || 0), 0),
      loan: b.filter(x => x.section === 'loan').reduce((a, x) => a + (Number(x.amount) || 0), 0)
    }
  }, [data])

  const changeMonth = (n: number) => {
    const d = new Date(`${month}-01`)
    d.setMonth(d.getMonth() + n)
    setMonth(monthKey(d))
  }

  const nav = [
    { id: 'dashboard', label: '대시보드', icon: Home },
    { id: 'calendar', label: '소비달력', icon: CalendarCheck },
    { id: 'budget', label: '이번 달 예산', icon: Target },
    { id: 'transactions', label: '편한 가계부', icon: CalendarDays },
    { id: 'accounts', label: '계좌 관리', icon: Landmark },
    { id: 'annual', label: '연간 결산', icon: BarChart3 },
    { id: 'profit_first', label: '수익먼저 시스템', icon: TrendingUp },
    { id: 'settings', label: '설정', icon: Settings }
  ] as const

  // 매달 반복되는 고정지출을 현재 월의 거래 목록에 자동 동기화
  useEffect(() => {
    if (!recurringFixed.length || !currentUser) return

    const [y, m] = month.split('-').map(Number)
    const maxDays = new Date(y, m, 0).getDate()
    let changed = false
    const nextTx = [...data.transactions]

    recurringFixed.forEach(rf => {
      const targetDay = Math.min(rf.day || 1, maxDays)
      const dateStr = `${month}-${String(targetDay).padStart(2, '0')}`

      // 이번 달에 이미 같은 고정지출이 존재하는지 확인
      const exists = nextTx.some(
        t => t.type === 'fixed_expense' && t.itemName === rf.itemName && t.date.startsWith(month)
      )

      if (!exists) {
        nextTx.push({
          id: uid(),
          type: 'fixed_expense',
          category: rf.category || '고정지출',
          itemName: rf.itemName,
          amount: rf.amount,
          date: dateStr,
          isRecurring: true,
          recurringDay: rf.day,
          memo: rf.memo || '매월 반복 고정지출'
        })
        changed = true
      }
    })

    if (changed) {
      persist({ ...data, transactions: nextTx })
    }
  }, [month, recurringFixed, currentUser])

  const openAddModal = (dateStr?: string, defaultType?: TransactionType, defaultCategory?: string) => {
    setEditing(null)
    setModalInitialDate(dateStr)
    setModalDefaultType(defaultType)
    setModalDefaultCategory(defaultCategory)
    setModal(true)
  }

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    const txId = editing?.id || uid()
    persist({
      ...data,
      transactions: [{ ...t, id: txId }, ...data.transactions.filter(x => x.id !== editing?.id)]
    })

    // 고정지출이면 매달 반복 템플릿에 자동 등록/동기화
    if (t.type === 'fixed_expense') {
      const day = parseInt(t.date.slice(8)) || 1
      const existingIdx = recurringFixed.findIndex(
        rf => rf.itemName === t.itemName || (editing && rf.itemName === editing.itemName)
      )
      if (existingIdx >= 0) {
        const updated = [...recurringFixed]
        updated[existingIdx] = {
          ...updated[existingIdx],
          itemName: t.itemName,
          amount: t.amount,
          day: day,
          category: t.category,
          memo: t.memo
        }
        persistRecurringFixed(updated)
      } else {
        persistRecurringFixed([
          ...recurringFixed,
          {
            id: uid(),
            itemName: t.itemName,
            amount: t.amount,
            day: day,
            category: t.category,
            memo: t.memo
          }
        ])
      }
    }

    setModal(false)
    setEditing(null)
    setModalInitialDate(undefined)
    setModalDefaultType(undefined)
    setModalDefaultCategory(undefined)
  }

  const deleteTransaction = (id: string) => {
    const target = data.transactions.find(x => x.id === id)
    if (target && target.type === 'fixed_expense') {
      // 고정지출 삭제 시 매달 반복 목록에서도 제거하여 다음 달 이후에도 자동 생성되지 않도록 함
      persistRecurringFixed(recurringFixed.filter(rf => rf.itemName !== target.itemName))
    }
    persist({
      ...data,
      transactions: data.transactions.filter(x => x.id !== id)
    })
    setModal(false)
    setEditing(null)
  }

  const deleteRecurringFixed = (rfId: string) => {
    const target = recurringFixed.find(rf => rf.id === rfId)
    if (target) {
      persistRecurringFixed(recurringFixed.filter(rf => rf.id !== rfId))
      persist({
        ...data,
        transactions: data.transactions.filter(t => !(t.type === 'fixed_expense' && t.itemName === target.itemName && t.date.startsWith(month)))
      })
    }
  }

  const addRecurringFixed = (item: Omit<RecurringFixedExpense, 'id'>) => {
    const newRf = { ...item, id: uid() }
    persistRecurringFixed([...recurringFixed, newRf])
    const [y, m] = month.split('-').map(Number)
    const maxDays = new Date(y, m, 0).getDate()
    const targetDay = Math.min(newRf.day || 1, maxDays)
    const dateStr = `${month}-${String(targetDay).padStart(2, '0')}`
    persist({
      ...data,
      transactions: [
        ...data.transactions,
        {
          id: uid(),
          type: 'fixed_expense',
          category: newRf.category || '고정지출',
          itemName: newRf.itemName,
          amount: newRf.amount,
          date: dateStr,
          isRecurring: true,
          recurringDay: newRf.day,
          memo: newRf.memo || '매월 반복 고정지출'
        }
      ]
    })
  }

  const saveAccount = (acc: Omit<Account, 'id'>) => {
    if (editingAccount) {
      persistAccounts(accounts.map(a => (a.id === editingAccount.id ? { ...acc, id: editingAccount.id } : a)))
    } else {
      persistAccounts([{ ...acc, id: uid() }, ...accounts])
    }
    setAccountModal(false)
    setEditingAccount(null)
  }

  const deleteAccount = (id: string) => {
    persistAccounts(accounts.filter(a => a.id !== id))
  }

  const addAccountItem = (accountId: string, item: Omit<AccountItem, 'id'>) => {
    persistAccounts(
      accounts.map(a => {
        if (a.id === accountId) {
          return { ...a, items: [...a.items, { ...item, id: uid() }] }
        }
        return a
      })
    )
    setItemModalAccount(null)
  }

  const deleteAccountItem = (accountId: string, itemId: string) => {
    persistAccounts(
      accounts.map(a => {
        if (a.id === accountId) {
          return { ...a, items: a.items.filter(i => i.id !== itemId) }
        }
        return a
      })
    )
  }

  if (!currentUser) {
    return <AuthScreen onLogin={(phone) => { setCurrentUser(phone); loadUserData(phone) }} />
  }

  return (
    <div className="app-shell">
      <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-icon"><Wallet /></div>
          <div className="brand-text">
            <span className="brand-sub">사명가의</span>
            <span className="brand-main">소비노트</span>
          </div>
        </div>
        <nav>
          {nav.map(n => (
            <button
              key={n.id}
              className={page === n.id ? 'active' : ''}
              onClick={() => { setPage(n.id); setMobileNav(false) }}
            >
              <n.icon />{n.label}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={() => { localStorage.removeItem('sobinote-session'); setCurrentUser(null); setData({ transactions: [], budgets: [], expectedIncome: 0 }); setAccounts([]) }}>
          <LogOut /> 로그아웃
        </button>
      </aside>

      <div className="main">
        <header>
          <button className="menu-btn" onClick={() => setMobileNav(!mobileNav)}><Menu /></button>
          <div>
            <p className="eyebrow">PERSONAL FINANCE</p>
            <h1>{nav.find(n => n.id === page)?.label}</h1>
          </div>
          <button className="profile-btn" onClick={() => setPage('settings')} title="설정으로 이동">
            <span className="profile-avatar">
              {userName ? (userName.length > 2 ? userName.slice(-2) : userName) : currentUser.slice(-2)}
            </span>
            {userName && <span className="profile-name-tag">{userName}님</span>}
          </button>
        </header>

        <div className="content">
          {page === 'dashboard' && (
            <Dashboard
              data={data}
              totals={totals}
              budgetTotals={budgetTotals}
              month={month}
              changeMonth={changeMonth}
              cats={cats}
              persist={persist}
              onAdd={() => openAddModal()}
              onEdit={(t: Transaction) => { setEditing(t); setModal(true) }}
            />
          )}
          {page === 'calendar' && (
            <CalendarPage
              data={data}
              month={month}
              changeMonth={changeMonth}
              onAdd={openAddModal}
              onEdit={t => { setEditing(t); setModal(true) }}
            />
          )}
          {page === 'budget' && (
            <Budget data={data} persist={persist} month={month} changeMonth={changeMonth} />
          )}
          {page === 'transactions' && (
            <Transactions
              data={data}
              cats={cats}
              persist={persist}
              month={month}
              changeMonth={changeMonth}
              onAdd={openAddModal}
              onEdit={t => { setEditing(t); setModal(true) }}
            />
          )}
          {page === 'accounts' && (
            <AccountsView
              accounts={accounts}
              onAddAccount={() => { setEditingAccount(null); setAccountModal(true) }}
              onEditAccount={acc => { setEditingAccount(acc); setAccountModal(true) }}
              onDeleteAccount={deleteAccount}
              onAddItem={acc => setItemModalAccount(acc)}
              onDeleteItem={deleteAccountItem}
            />
          )}
          {page === 'annual' && <Annual data={data} />}
          {page === 'profit_first' && (
            <ProfitFirstView
              months={profitFirstMonths}
              onUpdate={persistProfitFirst}
            />
          )}
          {page === 'settings' && (
            <SettingsView
              catGroups={catGroups}
              onUpdateCatGroups={persistCatGroups}
              recurringFixed={recurringFixed}
              onAddRecurringFixed={addRecurringFixed}
              onDeleteRecurringFixed={deleteRecurringFixed}
              currentUser={currentUser}
              userName={userName}
              onUpdateName={(name) => setUserName(name)}
            />
          )}
        </div>
      </div>

      {modal && (
        <TransactionModal
          initial={editing}
          initialDate={modalInitialDate}
          initialType={modalDefaultType}
          initialCategory={modalDefaultCategory}
          catGroups={catGroups}
          onClose={() => {
            setModal(false)
            setEditing(null)
            setModalInitialDate(undefined)
            setModalDefaultType(undefined)
            setModalDefaultCategory(undefined)
          }}
          onSave={addTransaction}
          onDelete={deleteTransaction}
        />
      )}

      {accountModal && (
        <AccountModal
          initial={editingAccount}
          onClose={() => { setAccountModal(false); setEditingAccount(null) }}
          onSave={saveAccount}
        />
      )}

      {itemModalAccount && (
        <AccountItemModal
          account={itemModalAccount}
          onClose={() => setItemModalAccount(null)}
          onSave={item => addAccountItem(itemModalAccount.id, item)}
        />
      )}
    </div>
  )
}

function MonthBar({ month, changeMonth }: { month: string; changeMonth: (n: number) => void }) {
  return (
    <div className="month-bar">
      <button onClick={() => changeMonth(-1)} aria-label="이전 달"><ChevronLeft /></button>
      <strong>{ymLabel(month)}</strong>
      <button onClick={() => changeMonth(1)} aria-label="다음 달"><ChevronRight /></button>
    </div>
  )
}

function Dashboard({ data, totals, budgetTotals, month, changeMonth, cats: userCats, persist, onAdd, onEdit }: any) {
  const catData = defaultCategories.map(category => ({
    name: category,
    value: data.transactions
      .filter((x: Transaction) => x.type === 'variable_expense' && x.category === category)
      .reduce((a: number, x: Transaction) => a + x.amount, 0)
  }))
  const remain = totals.income - totals.fixed - totals.variable - totals.saving - totals.loan

  const [sms, setSms] = useState('')
  const [quick, setQuick] = useState<Omit<Transaction, 'id'> | null>(null)

  const parse = () => setQuick(parseTransactionText(sms))
  const saveQuick = () => {
    if (!quick?.amount || !quick.itemName) return
    persist({ ...data, transactions: [{ ...quick, id: uid() }, ...data.transactions] })
    setQuick(null)
    setSms('')
  }

  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">{month === monthKey() ? '이번 달 현황' : '월간 현황'}</p>
          <h2>{ymLabel(month)}의 <em>소비 리포트</em></h2>
          <p className="muted">오늘도 작은 기록이 큰 여유를 만들어요.</p>
        </div>
        <MonthBar month={month} changeMonth={changeMonth} />
      </div>

      <div className="stats-grid">
        <StatCard title="수입" value={totals.income} caption="예상 수입 3,500,000원" tone="income-card" icon={ArrowDown} />
        <StatCard title="고정지출" value={totals.fixed} caption={`예산 ${money(budgetTotals.fixed)}`} tone="expense-card" icon={Home} />
        <StatCard title="변동지출" value={totals.variable} caption={`예산 ${money(budgetTotals.variable)}`} tone="expense-card" icon={CreditCard} />
        <StatCard title="저축·대출" value={totals.saving + totals.loan} caption={`저축 ${money(totals.saving)}`} tone="saving-card" icon={ArrowUp} />
      </div>

      <section className="panel quick-record">
        <div className="panel-head">
          <div>
            <p className="eyebrow">QUICK ENTRY</p>
            <h3>지출 바로입력</h3>
          </div>
          <span className="badge">문자 자동 분류</span>
        </div>
        <textarea
          value={sms}
          onChange={e => setSms(e.target.value)}
          placeholder="예: [신한카드] 스타벅스 5,500원 승인"
        />
        <div className="quick-actions">
          <button className="small-btn" onClick={parse}>자동으로 읽기</button>
          <button className="text-btn" onClick={onAdd}>직접 입력하기</button>
        </div>
        {quick && (
          <div className="parse-preview">
            <p className="muted">분류 결과를 확인하고 수정한 뒤 저장하세요.</p>
            <div className="form-grid">
              <label>유형
                <select value={quick.type} onChange={e => setQuick({ ...quick, type: e.target.value as TransactionType })}>
                  {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label>날짜
                <input type="date" value={quick.date} onChange={e => setQuick({ ...quick, date: e.target.value })} />
              </label>
              <label>항목명
                <input value={quick.itemName} onChange={e => setQuick({ ...quick, itemName: e.target.value })} />
              </label>
              <label>금액
                <input value={quick.amount.toLocaleString()} onChange={e => setQuick({ ...quick, amount: parseMoney(e.target.value) })} />
              </label>
              <label>카테고리
                <select value={quick.category} onChange={e => setQuick({ ...quick, category: e.target.value })}>
                  {(userCats || defaultCategories).map((c: string) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
            <button className="primary-btn full" onClick={saveQuick} disabled={!quick.amount || !quick.itemName}>
              이 거래 저장하기
            </button>
          </div>
        )}
      </section>

      <div className="dashboard-grid">
        <section className="panel chart-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">SPENDING MIX</p>
              <h3>변동지출 비중</h3>
            </div>
            <button className="icon-btn" onClick={onAdd}><Plus /></button>
          </div>
          <Donut data={catData} />
        </section>

        <section className="panel progress-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">BUDGET TRACKER</p>
              <h3>예산 대비 지출</h3>
            </div>
            <button className="link-btn">예산 수정 →</button>
          </div>
          {[
            ['고정지출', totals.fixed, budgetTotals.fixed],
            ['변동지출', totals.variable, budgetTotals.variable],
            ['저축', totals.saving, budgetTotals.saving]
          ].map(([n, v, b]) => (
            <Progress key={n as string} name={n as string} value={v as number} budget={b as number} />
          ))}

          <div className="category-compare">
            <div className="compare-title">
              <span>변동지출 카테고리</span>
              <small>예상금액 <b>사용금액</b></small>
            </div>
            {data.budgets
              .filter((x: Budget) => x.section === 'variable')
              .map((x: Budget) => (
                <Progress key={x.id} name={x.category || ''} value={x.actualAmount || 0} budget={x.amount} compact />
              ))}
          </div>
        </section>
      </div>

      <div className="bottom-grid">
        <section className="remain-card">
          <div>
            <p className="eyebrow">YOUR FLEXIBLE MONEY</p>
            <h3>남는 돈 = 추가 저축 가능</h3>
            <strong>{money(remain)}</strong>
            <p>{remain > 0 ? '이번 달도 계획대로 잘하고 있어요.' : '예산을 조금 조정해보세요.'}</p>
          </div>
          <div className="remain-circle">
            <span>저축률</span>
            <b>{totals.income ? Math.round((totals.saving / totals.income) * 100) : 0}%</b>
          </div>
        </section>

        <section className="panel recent">
          <div className="panel-head">
            <div>
              <p className="eyebrow">RECENT ACTIVITY</p>
              <h3>최근 거래</h3>
            </div>
            <button className="link-btn">전체보기 →</button>
          </div>
          {data.transactions.slice(0, 4).map((t: Transaction) => (
            <TransactionRow key={t.id} t={t} onEdit={onEdit} />
          ))}
        </section>
      </div>
    </>
  )
}

function Progress({ name, value, budget, compact = false }: { name: string; value: number; budget: number; compact?: boolean }) {
  const pct = budget ? Math.round((value / budget) * 100) : 0
  return (
    <div className={compact ? 'progress compact' : 'progress'}>
      <div>
        <span>{name}</span>
        <small>{money(value)} <b>/ {money(budget)}</b></small>
      </div>
      <div className="bar">
        <i className={pct > 100 ? 'over' : ''} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {!compact && <em>{pct}%</em>}
    </div>
  )
}

function TransactionRow({ t, onEdit }: { t: Transaction; onEdit: (t: Transaction) => void }) {
  const isPlus = t.type === 'income' || t.type === 'saving'
  const titleText = t.itemName?.trim() || (t.category && t.category !== '카테고리 없음' ? t.category : typeLabel[t.type])
  const catText = t.category && t.category !== '카테고리 없음' ? t.category : typeLabel[t.type]

  return (
    <button className="transaction-row" onClick={() => onEdit(t)}>
      <span className={`transaction-icon ${t.type}`}><Wallet /></span>
      <span className="transaction-info">
        <b>{titleText}</b>
        <small>{catText} · {t.date.slice(5).replace('-', '.')}</small>
      </span>
      <strong className={typeColor[t.type]}>
        {isPlus ? '+' : '-'}{money(t.amount)}
      </strong>
    </button>
  )
}

function Budget({ data, persist, month, changeMonth }: { data: MonthlyData; persist: (d: MonthlyData) => void; month: string; changeMonth: (n: number) => void }) {
  const [income, setIncome] = useState(data.expectedIncome)

  const add = (section: Budget['section']) =>
    persist({
      ...data,
      budgets: [
        ...data.budgets,
        {
          id: uid(),
          section,
          itemName: section === 'variable' ? undefined : '새 항목',
          category: section === 'variable' ? defaultCategories[0] : undefined,
          amount: 0,
          actualAmount: 0
        }
      ]
    })

  const remove = (id: string) => persist({ ...data, budgets: data.budgets.filter(x => x.id !== id) })
  const update = (id: string, key: string, value: string) =>
    persist({
      ...data,
      budgets: data.budgets.map(x =>
        x.id === id ? { ...x, [key]: key === 'amount' || key === 'transferDay' ? parseMoney(value) : value } : x
      )
    })

  const groups = [
    ['fixed', '고정지출', '월세·통신비 등 매달 정해진 지출'],
    ['variable', '변동지출', '카테고리별로 예상 금액을 정해요'],
    ['saving', '적금·연금·저축보험', '미래를 위한 나의 약속'],
    ['loan', '대출상환', '자동이체일을 함께 기록해요']
  ] as const

  const total = data.budgets.reduce((a, x) => a + x.amount, 0)

  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">MONTHLY PLANNING</p>
          <h2>이번 달 예산 짜기</h2>
          <p className="muted">미리 계획하면, 남는 돈이 보여요.</p>
        </div>
        <MonthBar month={month} changeMonth={changeMonth} />
      </div>

      <div className="income-input">
        <label>
          월급 / 예상 수입
          <input value={income.toLocaleString()} onChange={e => { const v = parseMoney(e.target.value); setIncome(v); persist({ ...data, expectedIncome: v }) }} />
          <span>원</span>
        </label>
        <div>
          <small>예상 총지출</small>
          <b>{money(total)}</b>
          <small>예상 잔액</small>
          <b className="text-income">{money(income - total)}</b>
        </div>
      </div>

      <div className="budget-sections">
        {groups.map(([section, title, desc]) => (
          <section className="panel budget-section" key={section}>
            <div className="panel-head">
              <div>
                <h3>{title}</h3>
                <p className="muted">{desc}</p>
              </div>
              <button className="small-btn" onClick={() => add(section)}>
                <Plus /> 항목 추가
              </button>
            </div>
            {data.budgets
              .filter(x => x.section === section)
              .map(x => (
                <div className="budget-line" key={x.id}>
                  <input
                    value={x.itemName || x.category || ''}
                    onChange={e => update(x.id, x.category ? 'category' : 'itemName', e.target.value)}
                  />
                  <input
                    className="amount-input"
                    value={x.amount.toLocaleString()}
                    onChange={e => update(x.id, 'amount', e.target.value)}
                  />
                  <span>원</span>
                  {section !== 'saving' && (
                    <input
                      className="day-input"
                      value={x.transferDay || ''}
                      placeholder="일"
                      onChange={e => update(x.id, 'transferDay', e.target.value)}
                    />
                  )}
                  <button onClick={() => remove(x.id)} aria-label="항목 삭제"><Trash2 /></button>
                </div>
              ))}
          </section>
        ))}
      </div>
    </>
  )
}

function getWeeksInMonth(month: string): { label: string; key: string; start: string; end: string }[] {
  const [y, m] = month.split('-').map(Number)
  const firstDay = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0)
  const weeks: { label: string; key: string; start: string; end: string }[] = []

  let weekNum = 1
  let cur = new Date(firstDay)

  while (cur <= lastDay) {
    const weekStart = new Date(cur)
    // Find end of this week (Sunday) or end of month, whichever is earlier
    const dayOfWeek = cur.getDay() // 0=Sun, 1=Mon, ...
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    const weekEnd = new Date(cur)
    weekEnd.setDate(cur.getDate() + daysUntilSunday)
    if (weekEnd > lastDay) weekEnd.setTime(lastDay.getTime())

    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    weeks.push({
      label: `${weekNum}주차 (${m}/${weekStart.getDate()} ~ ${m}/${weekEnd.getDate()})`,
      key: `${month}-W${weekNum}`,
      start: fmt(weekStart),
      end: fmt(weekEnd),
    })
    weekNum++
    cur = new Date(weekEnd)
    cur.setDate(cur.getDate() + 1)
  }
  return weeks
}

function Transactions({ data, cats, persist, month, changeMonth, onAdd, onEdit }: { data: MonthlyData; cats: string[]; persist: (d: MonthlyData) => void; month: string; changeMonth: (n: number) => void; onAdd: (dateStr?: string, defaultType?: TransactionType, defaultCategory?: string) => void; onEdit: (t: Transaction) => void }) {
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly')
  const monthTransactions = data.transactions.filter(t => t.date.startsWith(month))

  const incomeList = monthTransactions.filter(t => t.type === 'income')
  const savingList = monthTransactions.filter(t => t.type === 'saving')
  const fixedList = monthTransactions.filter(t => t.type === 'fixed_expense')
  const variableList = monthTransactions.filter(t => t.type === 'variable_expense' || t.type === 'loan_payment')

  // cats(지출 5대 카테고리) 외에 '카테고리 없음', 대출상환, 기타 등으로 등록된 모든 항목도 누락 없이 표시
  const allVariableCats = useMemo(() => {
    const list = [...cats]
    const varTx = (data.transactions || []).filter(
      (t: Transaction) => t.date.startsWith(month) && (t.type === 'variable_expense' || t.type === 'loan_payment')
    )
    varTx.forEach((t: Transaction) => {
      const c = t.category && t.category !== '카테고리 없음' ? t.category : '기타/미분류'
      if (!list.includes(c)) {
        list.push(c)
      }
    })
    return list
  }, [cats, data.transactions, month])

  const totalIncome = incomeList.reduce((a, b) => a + b.amount, 0)
  const totalSaving = savingList.reduce((a, b) => a + b.amount, 0)
  const totalFixed = fixedList.reduce((a, b) => a + b.amount, 0)
  const totalVariable = variableList.reduce((a, b) => a + b.amount, 0)

  // 이달의 소비 예산 = 이달의 수입 - 이달의 저축 - 이달의 고정지출
  const spendingBudget = totalIncome - totalSaving - totalFixed
  // 현재 남은 돈 = 이달의 소비 예산 - 이달의 생활비 지출 합계
  const remainingMoney = spendingBudget - totalVariable

  const handleTextChange = (key: 'savingGoal' | 'praisePoints' | 'reflectionPoints' | 'wishList' | 'consumptionGoal', val: string) => {
    persist({
      ...data,
      [key]: val
    })
  }

  const handleWeeklyFeedback = (weekKey: string, field: 'reflection' | 'praise', val: string) => {
    const prev = data.weeklyFeedback || {}
    persist({
      ...data,
      weeklyFeedback: {
        ...prev,
        [weekKey]: {
          reflection: prev[weekKey]?.reflection || '',
          praise: prev[weekKey]?.praise || '',
          [field]: val,
        }
      }
    })
  }

  const onAddWithDefault = (type: TransactionType, category?: string) => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    let defaultDate = todayStr
    if (!todayStr.startsWith(month)) {
      defaultDate = `${month}-01`
    }
    onAdd(defaultDate, type, category)
  }

  const weeks = getWeeksInMonth(month)

  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">DAILY RECORD</p>
          <h2>편한 가계부</h2>
          <p className="muted" style={{ margin: 0 }}>한눈에 거래를 확인하고 하단에 월말 피드백을 기록하세요.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          <div className="view-mode-toggle">
            <button
              className={viewMode === 'monthly' ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => setViewMode('monthly')}
            >
              월 단위
            </button>
            <button
              className={viewMode === 'weekly' ? 'toggle-btn active' : 'toggle-btn'}
              onClick={() => setViewMode('weekly')}
            >
              주 단위
            </button>
          </div>
          <MonthBar month={month} changeMonth={changeMonth} />
        </div>
      </div>

      {viewMode === 'monthly' ? (
        <>
          <div className="excel-layout">
            {/* 왼쪽 요약 지표 사이드바 */}
            <div className="excel-sidebar">
              <div className="excel-summary-card">
                <h3 className="sidebar-title">이달의 요약</h3>
                <div className="summary-row">
                  <span>이달의 수입</span>
                  <strong className="text-income">{totalIncome.toLocaleString()}원</strong>
                </div>
                <div className="summary-row">
                  <span>이달의 저축</span>
                  <strong className="text-primary">{totalSaving.toLocaleString()}원</strong>
                </div>
                <div className="summary-row">
                  <span>이달의 고정지출</span>
                  <strong className="text-expense">{totalFixed.toLocaleString()}원</strong>
                </div>
                <hr className="sidebar-divider" />
                <div className="summary-row highlight-budget">
                  <span>소비 예산</span>
                  <strong>{spendingBudget.toLocaleString()}원</strong>
                </div>
                <div className="summary-row highlight-expense">
                  <span>생활비 지출 합계</span>
                  <strong className="text-expense">{totalVariable.toLocaleString()}원</strong>
                </div>
                <div className={`summary-row highlight-remain ${remainingMoney >= 0 ? 'plus' : 'minus'}`}>
                  <span>현재 남은 돈</span>
                  <strong>{remainingMoney.toLocaleString()}원</strong>
                </div>
              </div>
            </div>

            {/* 오른쪽 메인 테이블 데이터 그리드 */}
            <div className="excel-main">
              <div className="excel-top-grid">
                {/* 수입 테이블 */}
                <div className="excel-table-container">
                  <div className="table-header-title text-income-bg">수입</div>
                  <div className="table-scroll-y">
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th style={{ width: '38px', textAlign: 'center' }}>날짜</th>
                          <th>내용</th>
                          <th style={{ width: '74px', textAlign: 'right' }}>금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeList.map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName || (t.category && t.category !== '카테고리 없음' ? t.category : '수입')}</td>
                            <td className="text-right text-income">+{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 5 - incomeList.length) }).map((_, i) => (
                          <tr key={`empty-income-${i}`} onClick={() => onAddWithDefault('income', '수입')} className="empty-tr">
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                          </tr>
                        ))}
                        <tr className="sum-row">
                          <td colSpan={2}>합계</td>
                          <td className="text-right text-income font-bold">+{totalIncome.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 저축 테이블 */}
                <div className="excel-table-container">
                  <div className="table-header-title text-saving-bg">저축</div>
                  <div className="table-scroll-y">
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th style={{ width: '38px', textAlign: 'center' }}>날짜</th>
                          <th>내용</th>
                          <th style={{ width: '74px', textAlign: 'right' }}>금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savingList.map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName || (t.category && t.category !== '카테고리 없음' ? t.category : '저축')}</td>
                            <td className="text-right text-primary font-bold">+{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 5 - savingList.length) }).map((_, i) => (
                          <tr key={`empty-saving-${i}`} onClick={() => onAddWithDefault('saving', '저축')} className="empty-tr">
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                          </tr>
                        ))}
                        <tr className="sum-row">
                          <td colSpan={2}>합계</td>
                          <td className="text-right text-primary font-bold">+{totalSaving.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 고정지출 테이블 */}
                <div className="excel-table-container">
                  <div className="table-header-title text-fixed-bg">고정지출</div>
                  <div className="table-scroll-y">
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th style={{ width: '38px', textAlign: 'center' }}>날짜</th>
                          <th>내용</th>
                          <th style={{ width: '74px', textAlign: 'right' }}>금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedList.map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName || (t.category && t.category !== '카테고리 없음' ? t.category : '고정지출')}</td>
                            <td className="text-right text-expense">-{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 5 - fixedList.length) }).map((_, i) => (
                          <tr key={`empty-fixed-${i}`} onClick={() => onAddWithDefault('fixed_expense', '고정지출')} className="empty-tr">
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                          </tr>
                        ))}
                        <tr className="sum-row">
                          <td colSpan={2}>합계</td>
                          <td className="text-right text-expense font-bold">-{totalFixed.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 변동지출 5대 카테고리 그리드 */}
              <div className="excel-bottom-section">
                <h3 className="section-title">변동지출 (생활비 지출)</h3>
                <div className="excel-bottom-grid">
                  {allVariableCats.map(cat => {
                    const catItems = variableList.filter(t => {
                      const c = t.category && t.category !== '카테고리 없음' ? t.category : '기타/미분류'
                      return c === cat
                    })
                    const catSum = catItems.reduce((a, b) => a + b.amount, 0)
                    return (
                      <div key={cat} className="excel-table-container variable-cat-table">
                        <div className="table-header-title cat-title">
                          <span>{cat}</span>
                          <small className="font-bold">{catSum.toLocaleString()}원</small>
                        </div>
                        <div className="var-cat-list">
                          {catItems.map(t => (
                            <div key={t.id} className="var-cat-row" onClick={() => onEdit(t)}>
                              <div className="var-cat-main">
                                <span className="var-cat-item">{t.itemName}</span>
                                <span className="var-cat-amount">-{t.amount.toLocaleString()}원</span>
                              </div>
                              <span className="var-cat-date">{t.date.slice(5).replace('-', '/')}  </span>
                            </div>
                          ))}
                          {catItems.length === 0 && (
                            <div className="var-cat-empty" onClick={() => onAddWithDefault('variable_expense', cat === '기타/미분류' ? undefined : cat)}>
                              클릭하여 추가
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 하단 메모 / 피드백 영역 */}
          <h3 className="section-title mt-6">이달의 목표 및 소비 피드백</h3>
          <div className="excel-goals-feedback-section">
            <div className="feedback-card highlight-target">
              <h4>추가 저축 목표</h4>
              <textarea
                value={data.savingGoal || ''}
                onChange={e => handleTextChange('savingGoal', e.target.value)}
                placeholder="이번 달 추가 저축 목표 금액이나 다짐을 적어보세요..."
              />
            </div>
            <div className="feedback-card">
              <h4>이달의 소비 목표</h4>
              <textarea
                value={data.consumptionGoal || ''}
                onChange={e => handleTextChange('consumptionGoal', e.target.value)}
                placeholder="이달의 소비 예산 내에서 실천할 목표를 적어보세요..."
              />
            </div>
            <div className="feedback-card highlight-wish">
              <h4>[Wish List] 추가 저축으로 하고 싶은 일</h4>
              <textarea
                value={data.wishList || ''}
                onChange={e => handleTextChange('wishList', e.target.value)}
                placeholder="목표 저축을 달성한 뒤 보상으로 하고 싶은 일..."
              />
            </div>
            <div className="feedback-card praise">
              <h4>칭찬할 점</h4>
              <textarea
                value={data.praisePoints || ''}
                onChange={e => handleTextChange('praisePoints', e.target.value)}
                placeholder="이번 달 잘한 소비나 절약 행동을 칭찬해주세요..."
              />
            </div>
            <div className="feedback-card reflection">
              <h4>반성할 점</h4>
              <textarea
                value={data.reflectionPoints || ''}
                onChange={e => handleTextChange('reflectionPoints', e.target.value)}
                placeholder="불필요했거나 아쉬웠던 지출을 돌아보고 반성해보세요..."
              />
            </div>
          </div>
        </>
      ) : (
        /* 주 단위 뷰 */
        <div className="weekly-view">
          {weeks.map(week => {
            const weekTx = monthTransactions.filter(t => t.date >= week.start && t.date <= week.end)
            const weekIncome = weekTx.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0)
            const weekExpense = weekTx.filter(t => t.type === 'variable_expense' || t.type === 'fixed_expense' || t.type === 'loan_payment').reduce((a, b) => a + b.amount, 0)
            const weekSaving = weekTx.filter(t => t.type === 'saving').reduce((a, b) => a + b.amount, 0)
            const feedback = data.weeklyFeedback?.[week.key] || { reflection: '', praise: '' }

            return (
              <div key={week.key} className="weekly-card">
                {/* 주차 헤더 */}
                <div className="weekly-card-header">
                  <h3 className="weekly-card-title">{week.label}</h3>
                  <div className="weekly-summary-badges">
                    {weekIncome > 0 && <span className="badge badge-income">+{weekIncome.toLocaleString()}원</span>}
                    {weekExpense > 0 && <span className="badge badge-expense">-{weekExpense.toLocaleString()}원</span>}
                    {weekSaving > 0 && <span className="badge badge-saving">저축 {weekSaving.toLocaleString()}원</span>}
                  </div>
                </div>

                {/* 수입 / 저축 / 고정지출 테이블 */}
                <div className="excel-top-grid weekly-top-grid">
                  {/* 수입 */}
                  <div className="excel-table-container">
                    <div className="table-header-title text-income-bg">수입</div>
                    <div className="table-scroll-y">
                    <table className="excel-table">
                      <thead><tr><th style={{ width: '38px', textAlign: 'center' }}>날짜</th><th>내용</th><th style={{ width: '74px', textAlign: 'right' }}>금액</th></tr></thead>
                      <tbody>
                        {weekTx.filter(t => t.type === 'income').map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName || (t.category && t.category !== '카테고리 없음' ? t.category : '수입')}</td>
                            <td className="text-right text-income">+{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 3 - weekTx.filter(t => t.type === 'income').length) }).map((_, i) => (
                          <tr key={`wi-${i}`} onClick={() => onAddWithDefault('income', '수입')} className="empty-tr">
                            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                          </tr>
                        ))}
                        <tr className="sum-row">
                          <td colSpan={2}>합계</td>
                          <td className="text-right text-income font-bold">+{weekIncome.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* 저축 */}
                <div className="excel-table-container">
                  <div className="table-header-title text-saving-bg">저축</div>
                  <div className="table-scroll-y">
                    <table className="excel-table">
                      <thead><tr><th style={{ width: '38px', textAlign: 'center' }}>날짜</th><th>내용</th><th style={{ width: '74px', textAlign: 'right' }}>금액</th></tr></thead>
                      <tbody>
                        {weekTx.filter(t => t.type === 'saving').map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName || (t.category && t.category !== '카테고리 없음' ? t.category : '저축')}</td>
                            <td className="text-right text-primary font-bold">+{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 3 - weekTx.filter(t => t.type === 'saving').length) }).map((_, i) => (
                          <tr key={`ws-${i}`} onClick={() => onAddWithDefault('saving', '저축')} className="empty-tr">
                            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                          </tr>
                        ))}
                        <tr className="sum-row">
                          <td colSpan={2}>합계</td>
                          <td className="text-right text-primary font-bold">+{weekSaving.toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* 고정지출 */}
                <div className="excel-table-container">
                  <div className="table-header-title text-fixed-bg">고정지출</div>
                  <div className="table-scroll-y">
                    <table className="excel-table">
                      <thead><tr><th style={{ width: '38px', textAlign: 'center' }}>날짜</th><th>내용</th><th style={{ width: '74px', textAlign: 'right' }}>금액</th></tr></thead>
                      <tbody>
                        {weekTx.filter(t => t.type === 'fixed_expense').map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName || (t.category && t.category !== '카테고리 없음' ? t.category : '고정지출')}</td>
                            <td className="text-right text-expense">-{t.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 3 - weekTx.filter(t => t.type === 'fixed_expense').length) }).map((_, i) => (
                          <tr key={`wf-${i}`} onClick={() => onAddWithDefault('fixed_expense', '고정지출')} className="empty-tr">
                            <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                          </tr>
                        ))}
                        <tr className="sum-row">
                            <td colSpan={2}>합계</td>
                            <td className="text-right text-expense font-bold">-{weekTx.filter(t => t.type === 'fixed_expense').reduce((a, b) => a + b.amount, 0).toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* 변동지출 카테고리 그리드 */}
                <div className="excel-bottom-section">
                  <h4 className="section-title" style={{ fontSize: '0.9rem', margin: '0.75rem 0 0.5rem' }}>변동지출 (생활비 지출)</h4>
                  <div className="excel-bottom-grid">
                    {allVariableCats.map(cat => {
                      const catItems = weekTx.filter(t => {
                        if (t.type !== 'variable_expense' && t.type !== 'loan_payment') return false
                        const c = t.category && t.category !== '카테고리 없음' ? t.category : '기타/미분류'
                        return c === cat
                      })
                      const catSum = catItems.reduce((a, b) => a + b.amount, 0)
                      return (
                        <div key={cat} className="excel-table-container variable-cat-table">
                          <div className="table-header-title cat-title">
                            <span>{cat}</span>
                            <small className="font-bold">{catSum.toLocaleString()}원</small>
                          </div>
                          <div className="var-cat-list">
                            {catItems.map(t => (
                              <div key={t.id} className="var-cat-row" onClick={() => onEdit(t)}>
                                <div className="var-cat-main">
                                  <span className="var-cat-item">{t.itemName}</span>
                                  <span className="var-cat-amount">-{t.amount.toLocaleString()}원</span>
                                </div>
                                <span className="var-cat-date">{t.date.slice(5).replace('-', '/')}  </span>
                              </div>
                            ))}
                            {catItems.length === 0 && (
                              <div className="var-cat-empty" onClick={() => onAddWithDefault('variable_expense', cat === '기타/미분류' ? undefined : cat)}>
                                클릭하여 추가
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>


                <div className="weekly-feedback">
                  <div className="weekly-feedback-row">
                    <span className="weekly-feedback-icon weekly-feedback-icon--reflection">💭</span>
                    <div className="weekly-feedback-field">
                      <label>반성할 것</label>
                      <input
                        type="text"
                        value={feedback.reflection}
                        onChange={e => handleWeeklyFeedback(week.key, 'reflection', e.target.value)}
                        placeholder="이번 주 아쉬웠던 지출 한 줄로 적기..."
                      />
                    </div>
                  </div>
                  <div className="weekly-feedback-row">
                    <span className="weekly-feedback-icon weekly-feedback-icon--praise">🌟</span>
                    <div className="weekly-feedback-field">
                      <label>칭찬할 것</label>
                      <input
                        type="text"
                        value={feedback.praise}
                        onChange={e => handleWeeklyFeedback(week.key, 'praise', e.target.value)}
                        placeholder="이번 주 잘한 소비 한 줄로 칭찬하기..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}


function CalendarPage({ data, month, changeMonth, onAdd, onEdit }: { data: MonthlyData; month: string; changeMonth: (n: number) => void; onAdd: (dateStr?: string) => void; onEdit: (t: Transaction) => void }) {
  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">SPENDING CALENDAR</p>
          <h2>소비달력</h2>
          <p className="muted">날짜별 수입과 지출을 한눈에 확인하세요.</p>
        </div>
        <MonthBar month={month} changeMonth={changeMonth} />
      </div>

      <SpendingCalendar data={data} month={month} onAdd={onAdd} onEdit={onEdit} />
    </>
  )
}

function CalendarDayTxList({ tx, maxVisible, onEdit }: { tx: Transaction[]; maxVisible: number; onEdit: (t: Transaction) => void }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? tx : tx.slice(0, maxVisible)
  const hasMore = tx.length > maxVisible

  return (
    <div className="cal-tx-list" onClick={e => e.stopPropagation()}>
      {visible.map(t => {
        const formattedAmount = t.amount >= 10000
          ? `${(t.amount / 10000).toFixed(t.amount % 10000 === 0 ? 0 : 1)}만`
          : `${Math.round(t.amount / 1000)}천`
        const isPlus = t.type === 'income' || t.type === 'saving'
        const displayName = t.itemName?.trim() || (t.category && t.category !== '카테고리 없음' ? t.category : typeLabel[t.type])
        return (
          <div
            key={t.id}
            className={`cal-tx-bar ${t.type === 'income' ? 'cal-bar-income' : t.type === 'saving' ? 'cal-bar-saving' : 'cal-bar-expense'}`}
            onClick={e => { e.stopPropagation(); onEdit(t) }}
            title={`${displayName} (${t.amount.toLocaleString()}원)`}
          >
            <span className="cal-bar-amount">
              {isPlus ? '+' : '-'}{formattedAmount}
            </span>
            <span className="cal-bar-item">
              {displayName}
            </span>
          </div>
        )
      })}
      {hasMore && (
        <button
          className="cal-tx-more"
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
        >
          {expanded ? '▲ 접기' : `▼ +${tx.length - maxVisible}건 더보기`}
        </button>
      )}
    </div>
  )
}

function SpendingCalendar({ data, month, onAdd, onEdit }: { data: MonthlyData; month: string; onAdd: (dateStr?: string) => void; onEdit: (t: Transaction) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [year, mon] = month.split('-').map(Number)
  const first = new Date(year, mon - 1, 1).getDay()
  const days = new Date(year, mon, 0).getDate()

  const totalCells = Math.ceil((first + days) / 7) * 7
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - first + 1
    return dayNum > 0 && dayNum <= days ? dayNum : null
  })

  const todayStr = new Date().toISOString().slice(0, 10)
  const dayTx = selected ? data.transactions.filter(t => t.date === selected) : []
  const selectedIncome = dayTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
  const selectedSaving = dayTx.filter(t => t.type === 'saving').reduce((a, t) => a + t.amount, 0)
  const selectedExpense = dayTx.filter(t => t.type === 'fixed_expense' || t.type === 'variable_expense' || t.type === 'loan_payment').reduce((a, t) => a + t.amount, 0)

  return (
    <section className="panel calendar-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">SPENDING CALENDAR</p>
          <h3>소비달력</h3>
        </div>
        <button className="small-btn" onClick={() => {
          const fallbackDate = todayStr.startsWith(month) ? todayStr : `${month}-01`
          onAdd(selected || fallbackDate)
        }}>
          <Plus /> 기록 추가
        </button>
      </div>

      <div className="calendar-grid calendar-week">
        <b>일</b><b>월</b><b>화</b><b>수</b><b>목</b><b>금</b><b>토</b>
      </div>

      <div className="calendar-grid">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="calendar-day cal-empty" />
          const dateKey = `${month}-${String(day).padStart(2, '0')}`
          const tx = data.transactions.filter(t => t.date === dateKey)
          const isToday = dateKey === todayStr
          const isSelected = selected === dateKey
          const MAX_VISIBLE = 4

          return (
            <div
              key={i}
              className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'is-today' : ''}`}
              onClick={() => setSelected(dateKey)}
            >
              <div className="calendar-day-header">
                <span>{day}</span>
              </div>
              {tx.length > 0 && (
                <CalendarDayTxList tx={tx} maxVisible={MAX_VISIBLE} onEdit={onEdit} />
              )}
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="calendar-detail">
          <div className="panel-head">
            <div>
              <h4>{selected.replaceAll('-', '.')} 거래 내역</h4>
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
                {selectedIncome > 0 && <span className="text-income">수입 +{money(selectedIncome)} </span>}
                {selectedSaving > 0 && <span className="text-primary">저축 +{money(selectedSaving)} </span>}
                {selectedExpense > 0 && <span className="text-expense">지출 -{money(selectedExpense)}</span>}
                {selectedIncome === 0 && selectedSaving === 0 && selectedExpense === 0 && '기록된 거래가 없습니다.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="small-btn" onClick={() => onAdd(selected)}>
                <Plus /> 이 날에 추가
              </button>
              <button className="text-btn" onClick={() => setSelected(null)}>닫기</button>
            </div>
          </div>
          {dayTx.length > 0 ? (
            dayTx.map(t => <TransactionRow key={t.id} t={t} onEdit={onEdit} />)
          ) : (
            <p className="empty">이 날은 등록된 거래가 없어요.</p>
          )}
        </div>
      )}
    </section>
  )
}

function AccountsView({
  accounts,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onAddItem,
  onDeleteItem
}: {
  accounts: Account[]
  onAddAccount: () => void
  onEditAccount: (acc: Account) => void
  onDeleteAccount: (id: string) => void
  onAddItem: (acc: Account) => void
  onDeleteItem: (accountId: string, itemId: string) => void
}) {
  const totalBalance = accounts.reduce((a, b) => a + b.balance, 0)
  const totalItemsCount = accounts.reduce((a, b) => a + b.items.length, 0)

  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">MY ACCOUNTS</p>
          <h2>계좌 및 용도 관리</h2>
          <p className="muted">나의 모든 은행 계좌와 용도를 한눈에 체계적으로 관리해보세요.</p>
        </div>
        <button className="primary-btn" onClick={onAddAccount}>
          <Plus /> 계좌 추가
        </button>
      </div>

      <section className="accounts-hero">
        <div>
          <p className="eyebrow">TOTAL BALANCE</p>
          <h3>등록된 계좌 총 자산</h3>
          <strong>{money(totalBalance)}</strong>
          <p>총 {accounts.length}개의 계좌 · {totalItemsCount}개의 세부 용도/자동이체 등록</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '16px', backdropFilter: 'blur(10px)' }}>
          <Landmark style={{ width: '2.5rem', height: '2.5rem', opacity: 0.9 }} />
        </div>
      </section>

      <div className="accounts-grid">
        {accounts.map(acc => (
          <div key={acc.id} className="account-card">
            <div className="account-card-header">
              <div>
                <span className="bank-tag">{acc.bankName}</span>
                <h3>{acc.accountName}</h3>
                {acc.accountNumber && <p className="account-number">{acc.accountNumber}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.2rem' }}>
                <button className="text-btn" style={{ fontSize: '0.78rem', padding: '0.2rem 0.4rem' }} onClick={() => onEditAccount(acc)}>
                  수정
                </button>
                <button className="text-btn" style={{ fontSize: '0.78rem', color: 'var(--expense)', padding: '0.2rem 0.4rem' }} onClick={() => onDeleteAccount(acc.id)}>
                  삭제
                </button>
              </div>
            </div>

            <div className="account-balance-box">
              <span>현재 잔액</span>
              <strong>{money(acc.balance)}</strong>
            </div>

            <div className="purpose-box">
              <small>계좌 용도</small>
              <p>{acc.purpose}</p>
            </div>

            <div className="account-items-section">
              <div className="account-items-head">
                <span>연결된 용도 및 자동이체 ({acc.items.length})</span>
                <button className="small-btn" onClick={() => onAddItem(acc)}>
                  <Plus /> 항목 추가
                </button>
              </div>

              {acc.items.length > 0 ? (
                <div className="account-items-list">
                  {acc.items.map(item => (
                    <div key={item.id} className="account-item-row">
                      <div className="account-item-info">
                        <b>{item.name}</b>
                        {item.memo && <small>{item.memo}</small>}
                      </div>
                      <div className="account-item-action">
                        {item.amount && item.amount > 0 && <strong>{money(item.amount)}</strong>}
                        <button
                          style={{ border: 0, background: 'none', color: '#c7c7cc', cursor: 'pointer', padding: '2px' }}
                          onClick={() => onDeleteItem(acc.id, item.id)}
                          aria-label="항목 삭제"
                        >
                          <X style={{ width: '0.9rem', height: '0.9rem' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: '0.78rem', textAlign: 'center', padding: '0.8rem 0' }}>
                  아직 연결된 세부 용도나 자동이체가 없습니다.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function AccountModal({
  initial,
  onClose,
  onSave
}: {
  initial: Account | null
  onClose: () => void
  onSave: (acc: Omit<Account, 'id'>) => void
}) {
  const [bankName, setBankName] = useState(initial?.bankName || '카카오뱅크')
  const [accountName, setAccountName] = useState(initial?.accountName || '')
  const [accountNumber, setAccountNumber] = useState(initial?.accountNumber || '')
  const [purpose, setPurpose] = useState(initial?.purpose || '')
  const [balance, setBalance] = useState(initial?.balance || 0)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountName || !purpose) return
    onSave({
      bankName,
      accountName,
      accountNumber,
      purpose,
      balance,
      items: initial?.items || []
    })
  }

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="panel-head">
          <h3>{initial ? '계좌 수정' : '새 계좌 추가'}</h3>
          <button onClick={onClose}><X /></button>
        </div>
        <form onSubmit={submit} className="form-stack" style={{ marginTop: '1rem' }}>
          <label>은행 / 금융기관
            <select value={bankName} onChange={e => setBankName(e.target.value)}>
              <option value="카카오뱅크">카카오뱅크</option>
              <option value="토스뱅크">토스뱅크</option>
              <option value="신한은행">신한은행</option>
              <option value="KB국민은행">KB국민은행</option>
              <option value="우리은행">우리은행</option>
              <option value="하나은행">하나은행</option>
              <option value="NH농협은행">NH농협은행</option>
              <option value="기업은행">기업은행</option>
              <option value="기타 금융사">기타 금융사</option>
            </select>
          </label>

          <label>계좌 이름 (별칭)
            <input required placeholder="예: 주거래 · 생활비 통장" value={accountName} onChange={e => setAccountName(e.target.value)} />
          </label>

          <label>계좌 용도 및 성격
            <input required placeholder="예: 월세/공과금 자동이체 및 데일리 변동지출용" value={purpose} onChange={e => setPurpose(e.target.value)} />
          </label>

          <label>계좌번호 (선택)
            <input placeholder="예: 3333-01-1234567" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
          </label>

          <label>현재 잔액
            <input value={balance.toLocaleString()} onChange={e => setBalance(parseMoney(e.target.value))} />
          </label>

          <button className="primary-btn full" type="submit">
            {initial ? '수정 완료' : '계좌 등록하기'}
          </button>
        </form>
      </section>
    </div>
  )
}

function AccountItemModal({
  account,
  onClose,
  onSave
}: {
  account: Account
  onClose: () => void
  onSave: (item: Omit<AccountItem, 'id'>) => void
}) {
  const [name, setName] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [memo, setMemo] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    onSave({ name, amount: amount || undefined, memo })
  }

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="panel-head">
          <div>
            <h3>세부 용도 및 항목 추가</h3>
            <p className="muted" style={{ fontSize: '0.78rem' }}>[{account.bankName}] {account.accountName} 계좌에 연결할 항목</p>
          </div>
          <button onClick={onClose}><X /></button>
        </div>
        <form onSubmit={submit} className="form-stack" style={{ marginTop: '1rem' }}>
          <label>항목명 / 용도
            <input required placeholder="예: 월세 자동이체, 넷플릭스 구독료, 비상금 저축" value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label>예정 금액 (선택)
            <input placeholder="0" value={amount ? amount.toLocaleString() : ''} onChange={e => setAmount(parseMoney(e.target.value))} />
          </label>

          <label>설명 / 출금 일정 메모 (선택)
            <input placeholder="예: 매월 25일 자동출금, 체크카드 전용" value={memo} onChange={e => setMemo(e.target.value)} />
          </label>

          <button className="primary-btn full" type="submit">
            항목 추가하기
          </button>
        </form>
      </section>
    </div>
  )
}

function TransactionModal({ initial, initialDate, initialType, initialCategory, catGroups, onClose, onSave, onDelete }: { initial: Transaction | null; initialDate?: string; initialType?: TransactionType; initialCategory?: string; catGroups: CategoryGroups; onClose: () => void; onSave: (t: Omit<Transaction, 'id'>) => void; onDelete?: (id: string) => void }) {
  const getCategoryOptions = (type: TransactionType) => {
    if (type === 'income') {
      return catGroups.income.length === 0
        ? ['카테고리 없음 (설정에서 추가 가능)']
        : ['카테고리 없음', ...catGroups.income]
    }
    if (type === 'saving') {
      return catGroups.saving.length === 0
        ? ['카테고리 없음 (설정에서 추가 가능)']
        : ['카테고리 없음', ...catGroups.saving]
    }
    if (type === 'loan_payment') {
      return catGroups.loan.length === 0
        ? ['카테고리 없음 (설정에서 추가 가능)']
        : ['카테고리 없음', ...catGroups.loan]
    }
    if (type === 'fixed_expense') {
      return ['고정지출', ...catGroups.expense]
    }
    return catGroups.expense.length > 0 ? catGroups.expense : ['기타']
  }

  const getDefaultCategory = (type: TransactionType, currentCat?: string) => {
    const opts = getCategoryOptions(type)
    if (currentCat && opts.includes(currentCat)) return currentCat
    return opts[0]
  }

  const initialResolvedType = initial?.type || initialType || 'variable_expense'

  const [t, setT] = useState<Omit<Transaction, 'id'>>(
    initial || {
      type: initialResolvedType,
      category: initialCategory || getDefaultCategory(initialResolvedType),
      itemName: '',
      amount: 0,
      date: initialDate || new Date().toISOString().slice(0, 10),
      isRecurring: false,
      memo: ''
    }
  )

  const handleTypeChange = (newType: TransactionType) => {
    setT(prev => ({
      ...prev,
      type: newType,
      category: getDefaultCategory(newType, prev.category)
    }))
  }

  const set = (k: string, v: any) => setT({ ...t, [k]: v })

  const currentYearMonth = t.date.slice(0, 7) || new Date().toISOString().slice(0, 7)
  const currentFixedDay = parseInt(t.date.slice(8)) || 25

  const itemPlaceholder =
    t.type === 'saving' ? '예: 주택청약, 적금, ETF' :
    t.type === 'loan_payment' ? '예: 전세대출 원리금, 신용대출' :
    t.type === 'income' ? '예: 월급, 부수입, 상여금' :
    t.type === 'fixed_expense' ? '예: 월세, 통신비, 보험료' : '예: 점심 식사, 카페'

  const handleSave = () => {
    let finalCat = t.category
    if (finalCat.includes('카테고리 없음')) {
      finalCat = '카테고리 없음'
    }
    const finalItemName = t.itemName.trim() || (finalCat !== '카테고리 없음' ? finalCat : typeLabel[t.type])
    onSave({ ...t, itemName: finalItemName, category: finalCat })
  }

  const currentCategoryOptions = getCategoryOptions(t.type)

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="panel-head">
          <h3>{initial ? '거래 수정' : '거래 추가'}</h3>
          <button onClick={onClose}><X /></button>
        </div>
        <div className="form-grid">
          <label>유형
            <select value={t.type} onChange={e => handleTypeChange(e.target.value as TransactionType)}>
              {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          {t.type === 'fixed_expense' ? (
            <label>매월 고정 지출일
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>매월</span>
                <select
                  value={currentFixedDay}
                  onChange={e => {
                    const dayNum = parseInt(e.target.value) || 1
                    const newDateStr = `${currentYearMonth}-${String(dayNum).padStart(2, '0')}`
                    set('date', newDateStr)
                  }}
                  style={{ flex: 1 }}
                >
                  {Array.from({ length: 31 }, (_, idx) => idx + 1).map(d => (
                    <option key={d} value={d}>{d}일</option>
                  ))}
                </select>
              </div>
              <small style={{ color: 'var(--muted)', fontSize: '0.74rem', marginTop: '0.35rem', display: 'block' }}>
                * 매달 이 날짜에 자동으로 달력과 가계부에 기록됩니다.
              </small>
            </label>
          ) : (
            <label>날짜
              <input type="date" value={t.date} onChange={e => set('date', e.target.value)} />
            </label>
          )}
          <label>항목명
            <input required value={t.itemName} placeholder={itemPlaceholder} onChange={e => set('itemName', e.target.value)} />
          </label>
          <label>금액
            <input required value={t.amount.toLocaleString()} onChange={e => set('amount', parseMoney(e.target.value))} />
          </label>
          <label>카테고리
            <select value={t.category} onChange={e => set('category', e.target.value)}>
              {currentCategoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>메모
            <input value={t.memo} onChange={e => set('memo', e.target.value)} placeholder="선택 입력" />
          </label>
        </div>
        <div className="modal-actions">
          {initial && onDelete && (
            <button
              type="button"
              className="danger-btn"
              onClick={() => {
                if (confirm('이 거래 내역을 삭제하시겠습니까?')) {
                  onDelete(initial.id)
                }
              }}
            >
              <Trash2 /> 삭제
            </button>
          )}
          <button className="primary-btn full" onClick={handleSave}>저장하기</button>
        </div>
      </section>
    </div>
  )
}

function Annual({ data }: { data: MonthlyData }) {
  const rows = [
    ['수입', 'income'],
    ['저축', 'saving'],
    ['고정지출', 'fixed_expense'],
    ['변동지출', 'variable_expense'],
    ['대출상환', 'loan_payment']
  ]

  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">YEAR IN REVIEW</p>
          <h2>2026 연간 결산</h2>
          <p className="muted">한 해의 흐름을 한눈에 살펴보세요.</p>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="panel-head">
          <h3>월별 요약</h3>
          <span className="badge">2026년</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>항목</th>
                {Array.from({ length: 12 }, (_, i) => <th key={i}>{i + 1}월</th>)}
                <th>연간합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, type]) => (
                <tr key={type}>
                  <th>{label}</th>
                  {Array.from({ length: 12 }, (_, i) => {
                    const total = data.transactions
                      .filter(t => t.type === type && t.date.startsWith(`2026-${String(i + 1).padStart(2, '0')}`))
                      .reduce((a, t) => a + t.amount, 0)
                    return <td key={i}>{total ? Math.round(total / 10000) + '만' : ''}</td>
                  })}
                  <td><b>{money(data.transactions.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0))}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="annual-cards">
        <section className="panel">
          <p className="eyebrow">LOAN BALANCE</p>
          <h3>대출 상세</h3>
          <strong>학자금 대출</strong>
          <p className="muted">월 상환액 180,000원 · 남은 잔액 4,320,000원</p>
        </section>

        <section className="panel">
          <p className="eyebrow">ACCOUNT FLOW</p>
          <h3>계좌 관리</h3>
          <strong>주거래 통장</strong>
          <p className="muted">자동이체 4건 · 이번 달 잔액 1,240,000원</p>
        </section>
      </div>
    </>
  )
}

function ProfitFirstView({ months, onUpdate }: { months: ProfitFirstMonth[]; onUpdate: (m: ProfitFirstMonth[]) => void }) {
  const ymLabel = (ym: string) => {
    const [y, m] = ym.split('-')
    return `${y}년 ${Number(m)}월`
  }

  const createNewMonth = () => {
    const now = new Date()
    const mk = monthKey(now)
    if (months.find(m => m.month === mk)) return

    const lastMonth = months.length > 0 ? months[0] : null
    const newAccounts: ProfitFirstAccount[] = lastMonth
      ? lastMonth.accounts.map(a => ({ ...a, id: uid(), actualAmount: 0, improvement: '' }))
      : defaultProfitFirstAccounts.map(a => ({ ...a, id: uid() }))

    onUpdate([{ month: mk, income: 0, accounts: newAccounts }, ...months])
  }

  const updateMonth = (monthStr: string, updater: (m: ProfitFirstMonth) => ProfitFirstMonth) => {
    onUpdate(months.map(m => m.month === monthStr ? updater(m) : m))
  }

  const addAccount = (monthStr: string) => {
    updateMonth(monthStr, m => ({
      ...m,
      accounts: [...m.accounts, { id: uid(), name: '새 계좌', targetPercent: 0, actualAmount: 0, improvement: '' }]
    }))
  }

  const removeAccount = (monthStr: string, accountId: string) => {
    updateMonth(monthStr, m => ({
      ...m,
      accounts: m.accounts.filter(a => a.id !== accountId)
    }))
  }

  const updateAccount = (monthStr: string, accountId: string, field: keyof ProfitFirstAccount, value: string | number) => {
    updateMonth(monthStr, m => ({
      ...m,
      accounts: m.accounts.map(a => a.id === accountId ? { ...a, [field]: value } : a)
    }))
  }

  const defaultNames = defaultProfitFirstAccounts.map(a => a.name)

  return (
    <>
      <section className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>수익먼저 시스템</h2>
          <button className="btn-primary" onClick={createNewMonth} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
            <Plus style={{ width: '1rem', height: '1rem' }} /> 이번 달 생성
          </button>
        </div>
        <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
          Profit First — 매출에서 수익을 먼저 떼어놓고, 나머지로 운영하세요.
        </p>
      </section>

      {months.length === 0 && (
        <section className="card" style={{ textAlign: 'center', padding: '3rem 1rem', color: '#8e8e93' }}>
          <TrendingUp style={{ width: '2.5rem', height: '2.5rem', margin: '0 auto 1rem', opacity: 0.4 }} />
          <p>아직 생성된 달이 없습니다.</p>
          <p style={{ fontSize: '0.82rem' }}>위의 &quot;이번 달 생성&quot; 버튼을 눌러 시작하세요.</p>
        </section>
      )}

      {months.map(pfMonth => {
        const totalActual = pfMonth.accounts.reduce((s, a) => s + (Number(a.actualAmount) || 0), 0)
        const totalTargetPercent = pfMonth.accounts.reduce((s, a) => s + (Number(a.targetPercent) || 0), 0)
        const totalAllocated = pfMonth.accounts.reduce((s, a) => s + (pfMonth.income * (Number(a.targetPercent) || 0) / 100), 0)
        const totalDelta = totalAllocated - totalActual

        return (
          <section key={pfMonth.month} className="card pf-month-card">
            <h3 className="pf-month-title">{ymLabel(pfMonth.month)}</h3>

            <div className="pf-table-wrapper">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>항목</th>
                    <th>실적</th>
                    <th>목표 배당률</th>
                    <th>할당금</th>
                    <th>델타</th>
                    <th>개선 방향</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {/* 수입 행 */}
                  <tr className="pf-income-row">
                    <td className="pf-label"><strong>수입 (Income)</strong></td>
                    <td>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="pf-input"
                        value={pfMonth.income ? pfMonth.income.toLocaleString('ko-KR') : ''}
                        placeholder="0"
                        onChange={e => {
                          const v = parseMoney(e.target.value)
                          updateMonth(pfMonth.month, m => ({ ...m, income: v }))
                        }}
                      />
                    </td>
                    <td className="pf-muted">—</td>
                    <td className="pf-muted">—</td>
                    <td className="pf-muted">—</td>
                    <td className="pf-muted">—</td>
                    <td></td>
                  </tr>

                  {/* 각 계좌 행 */}
                  {pfMonth.accounts.map(acc => {
                    const allocated = pfMonth.income * (Number(acc.targetPercent) || 0) / 100
                    const delta = allocated - (Number(acc.actualAmount) || 0)
                    const isCustom = !defaultNames.includes(acc.name)

                    return (
                      <tr key={acc.id}>
                        <td className="pf-label">
                          {isCustom ? (
                            <input
                              type="text"
                              className="pf-input pf-name-input"
                              value={acc.name}
                              onChange={e => updateAccount(pfMonth.month, acc.id, 'name', e.target.value)}
                            />
                          ) : (
                            acc.name
                          )}
                        </td>
                        <td>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="pf-input"
                            value={acc.actualAmount ? acc.actualAmount.toLocaleString('ko-KR') : ''}
                            placeholder="0"
                            onChange={e => updateAccount(pfMonth.month, acc.id, 'actualAmount', parseMoney(e.target.value))}
                          />
                        </td>
                        <td>
                          <div className="pf-percent-wrap">
                            <input
                              type="number"
                              className="pf-input pf-percent-input"
                              value={acc.targetPercent || ''}
                              placeholder="0"
                              min={0}
                              max={100}
                              onChange={e => updateAccount(pfMonth.month, acc.id, 'targetPercent', Number(e.target.value) || 0)}
                            />
                            <span className="pf-percent-sign">%</span>
                          </div>
                        </td>
                        <td className="pf-computed">{pfMonth.income > 0 ? money(allocated) : '—'}</td>
                        <td className={`pf-computed ${delta > 0 ? 'pf-delta-positive' : delta < 0 ? 'pf-delta-negative' : ''}`}>
                          {pfMonth.income > 0 && acc.actualAmount > 0 ? (delta >= 0 ? '+' : '') + money(delta) : '—'}
                        </td>
                        <td>
                          <input
                            type="text"
                            className="pf-input pf-improve-input"
                            value={acc.improvement}
                            placeholder="메모"
                            onChange={e => updateAccount(pfMonth.month, acc.id, 'improvement', e.target.value)}
                          />
                        </td>
                        <td>
                          {isCustom && (
                            <button
                              className="pf-delete-btn"
                              title="계좌 삭제"
                              onClick={() => {
                                if (confirm(`'${acc.name}' 계좌를 삭제하시겠습니까?`)) {
                                  removeAccount(pfMonth.month, acc.id)
                                }
                              }}
                            >
                              <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {/* 합계 행 */}
                  <tr className="pf-total-row">
                    <td className="pf-label"><strong>합계</strong></td>
                    <td className="pf-computed"><strong>{money(totalActual)}</strong></td>
                    <td className={`pf-computed pf-total-percent ${totalTargetPercent > 100 ? 'pf-over' : totalTargetPercent === 100 ? 'pf-exact' : ''}`}>
                      <strong>{totalTargetPercent}%</strong>
                    </td>
                    <td className="pf-computed"><strong>{pfMonth.income > 0 ? money(totalAllocated) : '—'}</strong></td>
                    <td className={`pf-computed ${totalDelta > 0 ? 'pf-delta-positive' : totalDelta < 0 ? 'pf-delta-negative' : ''}`}>
                      <strong>{pfMonth.income > 0 && totalActual > 0 ? (totalDelta >= 0 ? '+' : '') + money(totalDelta) : '—'}</strong>
                    </td>
                    <td className="pf-muted">—</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button
              className="pf-add-account-btn"
              onClick={() => addAccount(pfMonth.month)}
            >
              <Plus style={{ width: '0.9rem', height: '0.9rem' }} /> 계좌 추가
            </button>
          </section>
        )
      })}
    </>
  )
}

function SettingsView({
  catGroups,
  onUpdateCatGroups,
  recurringFixed,
  onAddRecurringFixed,
  onDeleteRecurringFixed,
  currentUser,
  userName,
  onUpdateName
}: {
  catGroups: CategoryGroups;
  onUpdateCatGroups: (c: CategoryGroups) => void;
  recurringFixed: RecurringFixedExpense[];
  onAddRecurringFixed: (item: Omit<RecurringFixedExpense, 'id'>) => void;
  onDeleteRecurringFixed: (id: string) => void;
  currentUser: string;
  userName: string;
  onUpdateName: (name: string) => void;
}) {
  const [catTab, setCatTab] = useState<'expense' | 'income' | 'saving' | 'loan'>('expense')
  const [newCat, setNewCat] = useState('')
  const [nameInput, setNameInput] = useState(userName)
  const [nameMsg, setNameMsg] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwOk, setPwOk] = useState(false)

  const [fixedName, setFixedName] = useState('')
  const [fixedAmount, setFixedAmount] = useState('')
  const [fixedDay, setFixedDay] = useState('25')
  const [showAddFixed, setShowAddFixed] = useState(false)

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = nameInput.trim()
    const users: Record<string, { password?: string; name?: string }> = JSON.parse(localStorage.getItem('sobinote-users') || '{}')
    if (!users[currentUser]) users[currentUser] = { password: '1234' }
    users[currentUser].name = trimmed
    localStorage.setItem('sobinote-users', JSON.stringify(users))
    onUpdateName(trimmed)
    await saveUserProfile(currentUser, { name: trimmed })
    setNameMsg('이름이 저장되었어요!')
    setTimeout(() => setNameMsg(''), 2500)
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg('')
    setPwOk(false)
    const users: Record<string, { password?: string; name?: string }> = JSON.parse(localStorage.getItem('sobinote-users') || '{}')
    const cloudUser = await getUserProfile(currentUser)
    const activePw = cloudUser?.password || users[currentUser]?.password || '1234'

    if (activePw !== currentPw) {
      setPwMsg('현재 비밀번호가 맞지 않아요.')
      return
    }
    if (newPw.length < 4) {
      setPwMsg('새 비밀번호는 4자 이상이어야 해요.')
      return
    }
    if (newPw !== confirmPw) {
      setPwMsg('새 비밀번호가 일치하지 않아요.')
      return
    }
    users[currentUser] = { ...users[currentUser], password: newPw }
    localStorage.setItem('sobinote-users', JSON.stringify(users))
    await saveUserProfile(currentUser, { password: newPw })
    setPwMsg('비밀번호가 변경되었어요!')
    setPwOk(true)
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
  }

  const displayPhone = currentUser.length === 11
    ? `${currentUser.slice(0, 3)}-${currentUser.slice(3, 7)}-${currentUser.slice(7)}`
    : currentUser

  return (
    <>
      <div className="hero-row">
        <div>
          <p className="eyebrow">PREFERENCES</p>
          <h2>설정</h2>
          <p className="muted">나에게 맞는 사명가의 소비노트로 다듬어보세요.</p>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h3>내 프로필</h3>
            <p className="muted">로그인된 계정: <b>{displayPhone}</b></p>
          </div>
        </div>
        <form onSubmit={saveName} className="form-stack" style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
          <label>사용자 이름 (별명)
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="예: 홍길동, 지출왕"
                style={{ flex: 1 }}
              />
              <button className="small-btn" type="submit">이름 저장</button>
            </div>
          </label>
          {nameMsg && <p className="success">{nameMsg}</p>}
        </form>

        <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '1.25rem 0' }} />

        <div className="panel-head" style={{ padding: 0, marginBottom: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem' }}>비밀번호 변경</h3>
          </div>
        </div>
        <form onSubmit={changePassword} className="form-stack" style={{ marginTop: '0.5rem' }}>
          <label>현재 비밀번호
            <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="현재 비밀번호 입력" />
          </label>
          <label>새 비밀번호
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="4자 이상" />
          </label>
          <label>새 비밀번호 확인
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="한번 더 입력" />
          </label>
          {pwMsg && <p className={pwOk ? 'success' : 'error'}>{pwMsg}</p>}
          <button className="small-btn" type="submit">비밀번호 변경</button>
        </form>
      </section>

      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h3>카테고리 설정</h3>
            <p className="muted">지출뿐 아니라 수입, 저축, 대출상환 카테고리도 자유롭게 관리하세요.</p>
          </div>
        </div>

        <div className="category-tabs">
          <button
            type="button"
            className={`category-tab-btn ${catTab === 'expense' ? 'active' : ''}`}
            onClick={() => { setCatTab('expense'); setNewCat('') }}
          >
            변동지출 <span className="tab-count">{catGroups.expense.length}</span>
          </button>
          <button
            type="button"
            className={`category-tab-btn ${catTab === 'income' ? 'active' : ''}`}
            onClick={() => { setCatTab('income'); setNewCat('') }}
          >
            수입 <span className="tab-count">{catGroups.income.length}</span>
          </button>
          <button
            type="button"
            className={`category-tab-btn ${catTab === 'saving' ? 'active' : ''}`}
            onClick={() => { setCatTab('saving'); setNewCat('') }}
          >
            저축 <span className="tab-count">{catGroups.saving.length}</span>
          </button>
          <button
            type="button"
            className={`category-tab-btn ${catTab === 'loan' ? 'active' : ''}`}
            onClick={() => { setCatTab('loan'); setNewCat('') }}
          >
            대출상환 <span className="tab-count">{catGroups.loan.length}</span>
          </button>
        </div>

        {catTab !== 'expense' && catGroups[catTab].length === 0 && (
          <div className="empty-cat-box">
            등록된 {catTab === 'income' ? '수입' : catTab === 'saving' ? '저축' : '대출상환'} 카테고리가 없습니다.<br />
            추가하지 않아도 거래 추가 시 <b>'카테고리 없음'</b>으로 편리하게 기록됩니다.
          </div>
        )}

        {catGroups[catTab].length > 0 && (
          <div className="category-settings">
            {catGroups[catTab].map((c, i) => (
              <div key={`${catTab}-${i}`}>
                <input
                  value={c}
                  onChange={e => {
                    const nextList = [...catGroups[catTab]]
                    nextList[i] = e.target.value
                    onUpdateCatGroups({ ...catGroups, [catTab]: nextList })
                  }}
                />
                <button
                  type="button"
                  title="삭제"
                  onClick={() => {
                    const nextList = catGroups[catTab].filter((_, j) => j !== i)
                    onUpdateCatGroups({ ...catGroups, [catTab]: nextList })
                  }}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="add-category">
          <input
            placeholder={`새 ${catTab === 'expense' ? '변동지출' : catTab === 'income' ? '수입' : catTab === 'saving' ? '저축' : '대출상환'} 카테고리 (예: ${catTab === 'saving' ? '청약, 적금, ETF' : catTab === 'loan' ? '전세대출, 신용대출' : catTab === 'income' ? '급여, 부수입' : '배달음식'})`}
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const trimmed = newCat.trim()
                if (trimmed) {
                  onUpdateCatGroups({ ...catGroups, [catTab]: [...catGroups[catTab], trimmed] })
                  setNewCat('')
                }
              }
            }}
          />
          <button
            className="small-btn"
            type="button"
            onClick={() => {
              const trimmed = newCat.trim()
              if (trimmed) {
                onUpdateCatGroups({ ...catGroups, [catTab]: [...catGroups[catTab], trimmed] })
                setNewCat('')
              }
            }}
          >
            <Plus /> 추가
          </button>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-head">
          <div>
            <h3>고정지출 템플릿</h3>
            <p className="muted">한 번 등록하면 매달 자동으로 반복 기록되며 언제든 삭제할 수 있어요.</p>
          </div>
          <button
            type="button"
            className="small-btn"
            onClick={() => setShowAddFixed(v => !v)}
          >
            <Plus /> {showAddFixed ? '닫기' : '새 고정지출 등록'}
          </button>
        </div>

        {showAddFixed && (
          <div style={{ background: '#f8f8fc', padding: '1rem', borderRadius: '12px', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '0.5rem' }}>
              <input
                placeholder="항목명 (예: 월세, 통신비)"
                value={fixedName}
                onChange={e => setFixedName(e.target.value)}
              />
              <input
                placeholder="금액 (예: 500,000)"
                value={fixedAmount}
                onChange={e => setFixedAmount(e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.85rem' }}>매월</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  placeholder="25"
                  value={fixedDay}
                  onChange={e => setFixedDay(e.target.value)}
                  style={{ width: '55px', textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.85rem' }}>일</span>
              </div>
            </div>
            <button
              type="button"
              className="small-btn"
              style={{ alignSelf: 'flex-end', background: '#0071e3', color: '#fff' }}
              onClick={() => {
                if (fixedName.trim() && parseMoney(fixedAmount) > 0) {
                  onAddRecurringFixed({
                    itemName: fixedName.trim(),
                    amount: parseMoney(fixedAmount),
                    day: parseInt(fixedDay) || 1,
                    category: '고정지출'
                  })
                  setFixedName('')
                  setFixedAmount('')
                  setShowAddFixed(false)
                }
              }}
            >
              등록하기
            </button>
          </div>
        )}

        <div className="template-list">
          {recurringFixed.length === 0 ? (
            <div className="empty-cat-box">
              등록된 반복 고정지출이 없습니다.<br />
              거래 등록 시 <b>'고정지출'</b>을 등록하거나 여기서 추가하시면 매달 자동으로 반복됩니다.
            </div>
          ) : (
            recurringFixed.map(rf => (
              <div key={rf.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f8fc', padding: '0.8rem 1rem', borderRadius: '12px' }}>
                <div>
                  <b style={{ fontSize: '0.95rem' }}>{rf.itemName}</b>
                  <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
                    매월 {rf.day}일 · <span className="text-expense font-bold">-{rf.amount.toLocaleString()}원</span>
                  </p>
                </div>
                <button
                  type="button"
                  title="삭제"
                  onClick={() => {
                    if (confirm(`'${rf.itemName}' 고정지출을 삭제하시겠습니까?`)) {
                      onDeleteRecurringFixed(rf.id)
                    }
                  }}
                  style={{ border: 'none', background: 'none', color: '#8e8e93', cursor: 'pointer', padding: '6px' }}
                >
                  <Trash2 style={{ width: '1.1rem', height: '1.1rem' }} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  )
}

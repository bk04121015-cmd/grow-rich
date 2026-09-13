'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, BarChart3, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, CreditCard, Home, Landmark, LogOut, Menu, Plus, Settings, Target, Trash2, Wallet, X } from 'lucide-react'
import {
  categories as defaultCategories,
  money,
  monthKey,
  parseMoney,
  type Account,
  type AccountItem,
  type Budget,
  type MonthlyData,
  type Transaction,
  type TransactionType,
  parseTransactionText,
  getUserProfile,
  saveUserProfile,
  loadUserDataFromFirestore,
  saveUserDataToFirestore,
  loadAccountsFromFirestore,
  saveAccountsToFirestore
} from '@/lib/firestore'

type Page = 'dashboard' | 'calendar' | 'budget' | 'transactions' | 'accounts' | 'annual' | 'settings'

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
        <span>사명가의 소비노트</span>
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
  const [cats, setCats] = useState(defaultCategories)
  const [modal, setModal] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState<string | undefined>(undefined)
  const [modalDefaultType, setModalDefaultType] = useState<TransactionType | undefined>(undefined)
  const [modalDefaultCategory, setModalDefaultCategory] = useState<string | undefined>(undefined)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [accountModal, setAccountModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [itemModalAccount, setItemModalAccount] = useState<Account | null>(null)
  const [mobileNav, setMobileNav] = useState(false)

  const loadUserData = async (phone: string) => {
    // 1. First load from local storage for instant responsiveness
    const savedData = localStorage.getItem(`sobinote-data-${phone}`)
    if (savedData) setData(JSON.parse(savedData))
    else setData({ transactions: [], budgets: [], expectedIncome: 0 })

    const savedAccounts = localStorage.getItem(`sobinote-accounts-${phone}`)
    if (savedAccounts) setAccounts(JSON.parse(savedAccounts))
    else setAccounts([])

    const users: Record<string, { password?: string; name?: string }> = JSON.parse(localStorage.getItem('sobinote-users') || '{}')
    setUserName(users[phone]?.name || '')

    // 2. Fetch from Firestore to sync latest across devices
    try {
      const [cloudData, cloudAccounts, cloudProfile] = await Promise.all([
        loadUserDataFromFirestore(phone),
        loadAccountsFromFirestore(phone),
        getUserProfile(phone)
      ])

      if (cloudData) {
        setData(cloudData)
        localStorage.setItem(`sobinote-data-${phone}`, JSON.stringify(cloudData))
      }
      if (cloudAccounts) {
        setAccounts(cloudAccounts)
        localStorage.setItem(`sobinote-accounts-${phone}`, JSON.stringify(cloudAccounts))
      }
      if (cloudProfile) {
        if (cloudProfile.name) setUserName(cloudProfile.name)
        users[phone] = { ...users[phone], ...cloudProfile }
        localStorage.setItem('sobinote-users', JSON.stringify(users))
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
    setData(next)
    if (currentUser) {
      localStorage.setItem(`sobinote-data-${currentUser}`, JSON.stringify(next))
      saveUserDataToFirestore(currentUser, next)
    }
  }

  const persistAccounts = (next: Account[]) => {
    setAccounts(next)
    if (currentUser) {
      localStorage.setItem(`sobinote-accounts-${currentUser}`, JSON.stringify(next))
      saveAccountsToFirestore(currentUser, next)
    }
  }

  const totals = useMemo(() => {
    const tx = data.transactions
    const sum = (t: TransactionType) => tx.filter(x => x.type === t).reduce((a, x) => a + x.amount, 0)
    return {
      income: sum('income'),
      fixed: sum('fixed_expense'),
      variable: sum('variable_expense'),
      saving: sum('saving'),
      loan: sum('loan_payment')
    }
  }, [data])

  const budgetTotals = useMemo(() => ({
    fixed: data.budgets.filter(x => x.section === 'fixed').reduce((a, x) => a + x.amount, 0),
    variable: data.budgets.filter(x => x.section === 'variable').reduce((a, x) => a + x.amount, 0),
    saving: data.budgets.filter(x => x.section === 'saving').reduce((a, x) => a + x.amount, 0),
    loan: data.budgets.filter(x => x.section === 'loan').reduce((a, x) => a + x.amount, 0)
  }), [data])

  const changeMonth = (n: number) => {
    const d = new Date(`${month}-01`)
    d.setMonth(d.getMonth() + n)
    setMonth(monthKey(d))
  }

  const nav = [
    { id: 'dashboard', label: '대시보드', icon: Home },
    { id: 'calendar', label: '소비달력', icon: CalendarCheck },
    { id: 'budget', label: '이번 달 예산', icon: Target },
    { id: 'transactions', label: '거래 기록', icon: CalendarDays },
    { id: 'accounts', label: '계좌 관리', icon: Landmark },
    { id: 'annual', label: '연간 결산', icon: BarChart3 },
    { id: 'settings', label: '설정', icon: Settings }
  ] as const

  if (!currentUser) return <AuthScreen onLogin={(phone) => { setCurrentUser(phone); loadUserData(phone) }} />

  const openAddModal = (dateStr?: string, defaultType?: TransactionType, defaultCategory?: string) => {
    setEditing(null)
    setModalInitialDate(dateStr)
    setModalDefaultType(defaultType)
    setModalDefaultCategory(defaultCategory)
    setModal(true)
  }

  const addTransaction = (t: Omit<Transaction, 'id'>) => {
    persist({
      ...data,
      transactions: [{ ...t, id: editing?.id || uid() }, ...data.transactions.filter(x => x.id !== editing?.id)]
    })
    setModal(false)
    setEditing(null)
    setModalInitialDate(undefined)
    setModalDefaultType(undefined)
    setModalDefaultCategory(undefined)
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

  return (
    <div className="app-shell">
      <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-icon"><Wallet /></div>
          <span>사명가의 소비노트</span>
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
          {page === 'settings' && (
            <SettingsView
              cats={cats}
              setCats={setCats}
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
          cats={cats}
          onClose={() => {
            setModal(false)
            setEditing(null)
            setModalInitialDate(undefined)
            setModalDefaultType(undefined)
            setModalDefaultCategory(undefined)
          }}
          onSave={addTransaction}
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
  return (
    <button className="transaction-row" onClick={() => onEdit(t)}>
      <span className={`transaction-icon ${t.type}`}><Wallet /></span>
      <span className="transaction-info">
        <b>{t.itemName}</b>
        <small>{t.category} · {t.date.slice(5).replace('-', '.')}</small>
      </span>
      <strong className={typeColor[t.type]}>
        {t.type === 'income' ? '+' : '-'}{money(t.amount)}
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
          <p className="muted">한눈에 거래를 확인하고 하단에 월말 피드백을 기록하세요.</p>
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
                          <th style={{ width: '50px' }}>날짜</th>
                          <th>내용</th>
                          <th style={{ width: '90px' }}>금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incomeList.map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName}</td>
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
                          <th style={{ width: '50px' }}>날짜</th>
                          <th>내용</th>
                          <th style={{ width: '90px' }}>금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savingList.map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName}</td>
                            <td className="text-right text-primary">-{t.amount.toLocaleString()}</td>
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
                          <td className="text-right text-primary font-bold">-{totalSaving.toLocaleString()}</td>
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
                          <th style={{ width: '50px' }}>날짜</th>
                          <th>내용</th>
                          <th style={{ width: '90px' }}>금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixedList.map(t => (
                          <tr key={t.id} onClick={() => onEdit(t)}>
                            <td className="text-center">{t.date.slice(8)}일</td>
                            <td className="truncate-cell" title={t.itemName}>{t.itemName}</td>
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
                  {cats.map(cat => {
                    const catItems = variableList.filter(t => t.category === cat)
                    const catSum = catItems.reduce((a, b) => a + b.amount, 0)
                    return (
                      <div key={cat} className="excel-table-container variable-cat-table">
                        <div className="table-header-title cat-title">
                          <span>{cat}</span>
                          <small className="font-bold">{catSum.toLocaleString()}원</small>
                        </div>
                        <div className="table-scroll-y font-small-table">
                          <table className="excel-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40px' }}>날짜</th>
                                <th>내용</th>
                                <th style={{ width: '75px' }}>금액</th>
                              </tr>
                            </thead>
                            <tbody>
                              {catItems.map(t => (
                                <tr key={t.id} onClick={() => onEdit(t)}>
                                  <td className="text-center">{t.date.slice(8)}일</td>
                                  <td className="truncate-cell" title={t.itemName}>{t.itemName}</td>
                                  <td className="text-right">-{t.amount.toLocaleString()}</td>
                                </tr>
                              ))}
                              {Array.from({ length: Math.max(0, 10 - catItems.length) }).map((_, i) => (
                                <tr key={`empty-var-${cat}-${i}`} onClick={() => onAddWithDefault('variable_expense', cat)} className="empty-tr">
                                  <td>&nbsp;</td>
                                  <td>&nbsp;</td>
                                  <td>&nbsp;</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                        <thead><tr><th style={{ width: '50px' }}>날짜</th><th>내용</th><th style={{ width: '90px' }}>금액</th></tr></thead>
                        <tbody>
                          {weekTx.filter(t => t.type === 'income').map(t => (
                            <tr key={t.id} onClick={() => onEdit(t)}>
                              <td className="text-center">{t.date.slice(8)}일</td>
                              <td className="truncate-cell" title={t.itemName}>{t.itemName}</td>
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
                        <thead><tr><th style={{ width: '50px' }}>날짜</th><th>내용</th><th style={{ width: '90px' }}>금액</th></tr></thead>
                        <tbody>
                          {weekTx.filter(t => t.type === 'saving').map(t => (
                            <tr key={t.id} onClick={() => onEdit(t)}>
                              <td className="text-center">{t.date.slice(8)}일</td>
                              <td className="truncate-cell" title={t.itemName}>{t.itemName}</td>
                              <td className="text-right text-primary">-{t.amount.toLocaleString()}</td>
                            </tr>
                          ))}
                          {Array.from({ length: Math.max(0, 3 - weekTx.filter(t => t.type === 'saving').length) }).map((_, i) => (
                            <tr key={`ws-${i}`} onClick={() => onAddWithDefault('saving', '저축')} className="empty-tr">
                              <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                            </tr>
                          ))}
                          <tr className="sum-row">
                            <td colSpan={2}>합계</td>
                            <td className="text-right text-primary font-bold">-{weekSaving.toLocaleString()}</td>
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
                        <thead><tr><th style={{ width: '50px' }}>날짜</th><th>내용</th><th style={{ width: '90px' }}>금액</th></tr></thead>
                        <tbody>
                          {weekTx.filter(t => t.type === 'fixed_expense').map(t => (
                            <tr key={t.id} onClick={() => onEdit(t)}>
                              <td className="text-center">{t.date.slice(8)}일</td>
                              <td className="truncate-cell" title={t.itemName}>{t.itemName}</td>
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
                    {cats.map(cat => {
                      const catItems = weekTx.filter(t => (t.type === 'variable_expense' || t.type === 'loan_payment') && t.category === cat)
                      const catSum = catItems.reduce((a, b) => a + b.amount, 0)
                      return (
                        <div key={cat} className="excel-table-container variable-cat-table">
                          <div className="table-header-title cat-title">
                            <span>{cat}</span>
                            <small className="font-bold">{catSum.toLocaleString()}원</small>
                          </div>
                          <div className="table-scroll-y font-small-table">
                            <table className="excel-table">
                              <thead><tr><th style={{ width: '40px' }}>날짜</th><th>내용</th><th style={{ width: '75px' }}>금액</th></tr></thead>
                              <tbody>
                                {catItems.map(t => (
                                  <tr key={t.id} onClick={() => onEdit(t)}>
                                    <td className="text-center">{t.date.slice(8)}일</td>
                                    <td className="truncate-cell" title={t.itemName}>{t.itemName}</td>
                                    <td className="text-right">-{t.amount.toLocaleString()}</td>
                                  </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 5 - catItems.length) }).map((_, i) => (
                                  <tr key={`wv-${cat}-${i}`} onClick={() => onAddWithDefault('variable_expense', cat)} className="empty-tr">
                                    <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
        return (
          <div
            key={t.id}
            className={`cal-tx-bar ${t.type === 'income' ? 'cal-bar-income' : t.type === 'saving' ? 'cal-bar-saving' : 'cal-bar-expense'}`}
            onClick={e => { e.stopPropagation(); onEdit(t) }}
            title={`${t.itemName} (${t.amount.toLocaleString()}원)`}
          >
            <span className="cal-bar-amount">
              {t.type === 'income' ? '+' : '-'}{formattedAmount}
            </span>
            <span className="cal-bar-item">
              {t.itemName}
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
  const selectedExpense = dayTx.filter(t => t.type !== 'income').reduce((a, t) => a + t.amount, 0)

  return (
    <section className="panel calendar-panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">SPENDING CALENDAR</p>
          <h3>소비달력</h3>
        </div>
        <button className="small-btn" onClick={() => onAdd(selected || undefined)}>
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
                {selectedExpense > 0 && <span className="text-expense">지출 -{money(selectedExpense)}</span>}
                {selectedIncome === 0 && selectedExpense === 0 && '기록된 거래가 없습니다.'}
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

function TransactionModal({ initial, initialDate, initialType, initialCategory, cats, onClose, onSave }: { initial: Transaction | null; initialDate?: string; initialType?: TransactionType; initialCategory?: string; cats: string[]; onClose: () => void; onSave: (t: Omit<Transaction, 'id'>) => void }) {
  const [t, setT] = useState<Omit<Transaction, 'id'>>(
    initial || {
      type: initialType || 'variable_expense',
      category: initialCategory || (initialType === 'income' ? '수입' : cats[0]),
      itemName: '',
      amount: 0,
      date: initialDate || new Date().toISOString().slice(0, 10),
      isRecurring: false,
      memo: ''
    }
  )

  const set = (k: string, v: any) => setT({ ...t, [k]: v })

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <div className="panel-head">
          <h3>{initial ? '거래 수정' : '거래 추가'}</h3>
          <button onClick={onClose}><X /></button>
        </div>
        <div className="form-grid">
          <label>유형
            <select value={t.type} onChange={e => set('type', e.target.value)}>
              {Object.entries(typeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label>날짜
            <input type="date" value={t.date} onChange={e => set('date', e.target.value)} />
          </label>
          <label>항목명
            <input required value={t.itemName} placeholder="예: 점심 식사" onChange={e => set('itemName', e.target.value)} />
          </label>
          <label>금액
            <input required value={t.amount.toLocaleString()} onChange={e => set('amount', parseMoney(e.target.value))} />
          </label>
          <label>카테고리
            <select value={t.category} onChange={e => set('category', e.target.value)}>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>메모
            <input value={t.memo} onChange={e => set('memo', e.target.value)} placeholder="선택 입력" />
          </label>
        </div>
        <button className="primary-btn full" onClick={() => onSave(t)}>저장하기</button>
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

function SettingsView({
  cats,
  setCats,
  currentUser,
  userName,
  onUpdateName
}: {
  cats: string[];
  setCats: (c: string[]) => void;
  currentUser: string;
  userName: string;
  onUpdateName: (name: string) => void;
}) {
  const [newCat, setNewCat] = useState('')
  const [nameInput, setNameInput] = useState(userName)
  const [nameMsg, setNameMsg] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwOk, setPwOk] = useState(false)

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
            <h3>변동지출 카테고리</h3>
            <p className="muted">나의 소비 습관에 맞게 관리해요.</p>
          </div>
        </div>
        <div className="category-settings">
          {cats.map((c, i) => (
            <div key={c}>
              <input
                value={c}
                onChange={e => {
                  const n = [...cats]
                  n[i] = e.target.value
                  setCats(n)
                }}
              />
              <button onClick={() => setCats(cats.filter((_, j) => j !== i))}><Trash2 /></button>
            </div>
          ))}
        </div>
        <div className="add-category">
          <input
            placeholder="새 카테고리 이름"
            value={newCat}
            onChange={e => setNewCat(e.target.value)}
          />
          <button
            className="small-btn"
            onClick={() => {
              if (newCat) setCats([...cats, newCat])
              setNewCat('')
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
            <p className="muted">매달 반복되는 항목을 미리 등록해두세요.</p>
          </div>
          <button className="small-btn"><Plus /> 템플릿 추가</button>
        </div>
        <div className="template-list">
          <span>월세 <b>매월 25일 · 850,000원</b></span>
          <span>통신비 <b>매월 15일 · 65,000원</b></span>
        </div>
      </section>
    </>
  )
}

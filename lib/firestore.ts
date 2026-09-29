import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './firebase'

export type TransactionType = 'income' | 'fixed_expense' | 'variable_expense' | 'saving' | 'loan_payment'
export type Transaction = { id: string; type: TransactionType; category: string; itemName: string; amount: number; date: string; isRecurring: boolean; recurringDay?: number; memo: string }
export type RecurringFixedExpense = { id: string; itemName: string; amount: number; day: number; category: string; memo?: string }
export type Budget = { id: string; section: 'fixed' | 'variable' | 'saving' | 'loan'; itemName?: string; category?: string; amount: number; actualAmount?: number; transferDay?: number }

export type AccountItem = {
  id: string
  name: string
  amount?: number
  memo?: string
}

export type Account = {
  id: string
  bankName: string
  accountName: string
  accountNumber?: string
  purpose: string
  balance: number
  items: AccountItem[]
}

export type ProfitFirstAccount = {
  id: string
  name: string
  targetPercent: number
  actualAmount: number
  improvement: string
}

export type ProfitFirstMonth = {
  month: string
  income: number
  accounts: ProfitFirstAccount[]
}

export const defaultProfitFirstAccounts: Omit<ProfitFirstAccount, 'id'>[] = [
  { name: '수익 (Profit)', targetPercent: 0, actualAmount: 0, improvement: '' },
  { name: '소유주 보상 (Owner\'s Comp)', targetPercent: 0, actualAmount: 0, improvement: '' },
  { name: '세금 (Tax)', targetPercent: 0, actualAmount: 0, improvement: '' },
  { name: '운영비용 (OpEx)', targetPercent: 0, actualAmount: 0, improvement: '' },
]

export type MonthlyData = {
  expectedIncome: number;
  budgets: Budget[];
  transactions: Transaction[];
  savingGoal?: string;
  praisePoints?: string;
  reflectionPoints?: string;
  wishList?: string;
  consumptionGoal?: string;
  weeklyFeedback?: Record<string, { reflection: string; praise: string }>;
}

export type CategoryGroups = {
  expense: string[];
  income: string[];
  saving: string[];
  loan: string[];
}

export const categories = ['식비/외식비', '생필품비', '교육/문화비', '교통/유류비', '미용/의료비 등 기타']
export const defaultCategoryGroups: CategoryGroups = {
  expense: categories,
  income: [],
  saving: [],
  loan: []
}
export const collectionPath = (uid: string, name: string) => collection(db!, 'users', uid, name)

export async function getUserProfile(phone: string): Promise<{ password?: string; name?: string } | null> {
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'userAccounts', phone))
    return snap.exists() ? (snap.data() as { password?: string; name?: string }) : null
  } catch (err) {
    console.error('Failed to get user profile from Firestore:', err)
    return null
  }
}

export async function saveUserProfile(phone: string, profile: { password?: string; name?: string }) {
  if (!db) return
  try {
    await setDoc(doc(db, 'userAccounts', phone), profile, { merge: true })
  } catch (err) {
    console.error('Failed to save user profile to Firestore:', err)
  }
}

export async function loadUserDataFromFirestore(phone: string): Promise<MonthlyData | null> {
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'userData', phone))
    return snap.exists() ? (snap.data() as MonthlyData) : null
  } catch (err) {
    console.error('Failed to load user data from Firestore:', err)
    return null
  }
}

export async function saveUserDataToFirestore(phone: string, data: MonthlyData) {
  if (!db) return
  try {
    await setDoc(doc(db, 'userData', phone), data, { merge: true })
  } catch (err) {
    console.error('Failed to save user data to Firestore:', err)
  }
}

export async function loadAccountsFromFirestore(phone: string): Promise<Account[] | null> {
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'userBankAccounts', phone))
    return snap.exists() ? ((snap.data() as { accounts: Account[] }).accounts || []) : null
  } catch (err) {
    console.error('Failed to load accounts from Firestore:', err)
    return null
  }
}

export async function saveAccountsToFirestore(phone: string, accounts: Account[]) {
  if (!db) return
  try {
    await setDoc(doc(db, 'userBankAccounts', phone), { accounts }, { merge: true })
  } catch (err) {
    console.error('Failed to save accounts to Firestore:', err)
  }
}

export async function loadUserSettingsFromFirestore(phone: string): Promise<{ catGroups?: CategoryGroups; recurringFixed?: RecurringFixedExpense[] } | null> {
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'userSettings', phone))
    return snap.exists() ? (snap.data() as { catGroups?: CategoryGroups; recurringFixed?: RecurringFixedExpense[] }) : null
  } catch (err) {
    console.error('Failed to load user settings from Firestore:', err)
    return null
  }
}

export async function saveUserSettingsToFirestore(phone: string, settings: { catGroups?: CategoryGroups; recurringFixed?: RecurringFixedExpense[] }) {
  if (!db) return
  try {
    await setDoc(doc(db, 'userSettings', phone), settings, { merge: true })
  } catch (err) {
    console.error('Failed to save user settings to Firestore:', err)
  }
}

export async function loadTransactions(uid: string, month: string) {
  if (!db) return []
  const snap = await getDocs(collectionPath(uid, 'transactions'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), date: d.data().date?.toDate?.()?.toISOString?.() ?? d.data().date }))
    .filter((t) => String(t.date).startsWith(month)) as Transaction[]
}
export async function saveTransaction(uid: string, value: Transaction) {
  if (!db) return
  const ref = value.id ? doc(db, 'users', uid, 'transactions', value.id) : doc(collectionPath(uid, 'transactions'))
  await setDoc(ref, { ...value, date: Timestamp.fromDate(new Date(value.date)) }, { merge: true })
}
export async function removeTransaction(uid: string, id: string) { if (db) await deleteDoc(doc(db, 'users', uid, 'transactions', id)) }
export async function saveMonth(uid: string, month: string, data: MonthlyData) { if (db) await setDoc(doc(db, 'users', uid, 'monthlyBudgets', month), data, { merge: true }) }
export async function loadMonth(uid: string, month: string): Promise<MonthlyData | null> { if (!db) return null; const snap = await getDocs(collectionPath(uid, 'monthlyBudgets')); const found = snap.docs.find((d) => d.id === month); return found ? found.data() as MonthlyData : null }
export async function saveSetting(uid: string, name: string, id: string, data: unknown) { if (db) await setDoc(doc(db, 'users', uid, name, id), data as Record<string, unknown>, { merge: true }) }
export async function removeSetting(uid: string, name: string, id: string) { if (db) await deleteDoc(doc(db, 'users', uid, name, id)) }

export const money = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const parseMoney = (s: string) => Number(s.replaceAll(',', '').replace(/[^0-9]/g, '')) || 0

export function parseTransactionText(text: string): Omit<Transaction, 'id'> {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const amountMatch = normalized.match(/(?:금액|승인금액|출금|입금|결제)?\s*[:：]?\s*([0-9][0-9,]*)\s*원?/) || normalized.match(/([0-9][0-9,]*)\s*원/)
  const amount = amountMatch ? parseMoney(amountMatch[1]) : 0
  const income = /입금|급여|월급|환급|송금받음|입금완료/.test(normalized)
  const category = /식당|카페|커피|스타벅스|배달|치킨|외식/.test(normalized) ? categories[0] : /편의점|마트|온라인몰|생필품/.test(normalized) ? categories[1] : /학원|강의|서점|영화|문화/.test(normalized) ? categories[2] : /택시|버스|지하철|주유|교통/.test(normalized) ? categories[3] : categories[4]
  const type: TransactionType = income ? 'income' : 'variable_expense'
  const dateMatch = normalized.match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/)
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}` : new Date().toISOString().slice(0, 10)
  const cleanedName = normalized.replace(/20\d{2}[./-]\d{1,2}[./-]\d{1,2}/, '').replace(/[0-9][0-9,]*\s*원/g, '').replace(/입금|출금|승인|결제|이체|금액|완료/g, '').trim()
  return { type, category: income ? '수입' : category, itemName: cleanedName || (income ? '입금' : '새 소비'), amount, date, isRecurring: false, memo: text }
}

export const demoData: MonthlyData = { expectedIncome: 3_500_000, budgets: [
  { id: 'f1', section: 'fixed', itemName: '월세', amount: 850000, transferDay: 25 }, { id: 'f2', section: 'fixed', itemName: '통신비', amount: 65000, transferDay: 15 },
  { id: 'v1', section: 'variable', category: categories[0], amount: 450000, actualAmount: 318000 }, { id: 'v2', section: 'variable', category: categories[1], amount: 180000, actualAmount: 94000 }, { id: 'v3', section: 'variable', category: categories[2], amount: 250000, actualAmount: 186000 }, { id: 'v4', section: 'variable', category: categories[3], amount: 180000, actualAmount: 72000 }, { id: 'v5', section: 'variable', category: categories[4], amount: 150000, actualAmount: 115000 },
  { id: 's1', section: 'saving', itemName: '청년희망적금', amount: 500000 }, { id: 'l1', section: 'loan', itemName: '학자금 대출', amount: 180000, transferDay: 10 },
], transactions: [
  { id: 't1', type: 'income', category: '급여', itemName: '3월 급여', amount: 3500000, date: '2026-08-25', isRecurring: true, memo: '월급' }, { id: 't2', type: 'fixed_expense', category: '주거비', itemName: '월세', amount: 850000, date: '2026-08-25', isRecurring: true, memo: '' }, { id: 't3', type: 'variable_expense', category: categories[0], itemName: '친구와 저녁', amount: 42000, date: '2026-08-27', isRecurring: false, memo: '' }, { id: 't4', type: 'saving', category: '저축', itemName: '청년희망적금', amount: 500000, date: '2026-08-10', isRecurring: true, memo: '' }, { id: 't5', type: 'variable_expense', category: categories[2], itemName: '온라인 강의', amount: 89000, date: '2026-08-08', isRecurring: false, memo: '' },
] }

export const demoAccounts: Account[] = [
  {
    id: 'acc1',
    bankName: '카카오뱅크',
    accountName: '주거래 · 생활비 통장',
    accountNumber: '3333-01-1234567',
    purpose: '급여 수령 및 데일리 변동지출 결제용',
    balance: 2450000,
    items: [
      { id: 'i1', name: '월세 자동이체', amount: 850000, memo: '매월 25일 출금' },
      { id: 'i2', name: '통신비 자동이체', amount: 65000, memo: '매월 15일 출금' },
      { id: 'i3', name: '식비/생활비 카드 대금', amount: 450000, memo: '체크카드 연동' }
    ]
  },
  {
    id: 'acc2',
    bankName: '토스뱅크',
    accountName: '비상금 / 파킹 통장',
    accountNumber: '1000-02-9876543',
    purpose: '여유 자금 보관 및 예비 비상금관리',
    balance: 5200000,
    items: [
      { id: 'i4', name: '여행 비상금', amount: 1500000, memo: '여름 휴가 대비' },
      { id: 'i5', name: '경조사 예비비', amount: 500000, memo: '갑작스러운 지출 대비' }
    ]
  },
  {
    id: 'acc3',
    bankName: '신한은행',
    accountName: '청년희망적금 통장',
    accountNumber: '110-123-456789',
    purpose: '목돈 마련을 위한 저축 전용 계좌',
    balance: 6000000,
    items: [
      { id: 'i6', name: '청년희망적금 납입', amount: 500000, memo: '매월 10일 자동이체' }
    ]
  }
]

export async function loadProfitFirstFromFirestore(phone: string): Promise<ProfitFirstMonth[] | null> {
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'userProfitFirst', phone))
    return snap.exists() ? ((snap.data() as { months: ProfitFirstMonth[] }).months || []) : null
  } catch (err) {
    console.error('Failed to load Profit First data from Firestore:', err)
    return null
  }
}

export async function saveProfitFirstToFirestore(phone: string, months: ProfitFirstMonth[]) {
  if (!db) return
  try {
    await setDoc(doc(db, 'userProfitFirst', phone), { months }, { merge: true })
  } catch (err) {
    console.error('Failed to save Profit First data to Firestore:', err)
  }
}

export const noop = addDoc

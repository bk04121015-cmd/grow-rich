import { addDoc, collection, deleteDoc, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from './firebase'

export type TransactionType = 'income' | 'fixed_expense' | 'variable_expense' | 'saving' | 'loan_payment'
export type Transaction = { id: string; type: TransactionType; category: string; itemName: string; amount: number; date: string; isRecurring: boolean; recurringDay?: number; memo: string }
export type Budget = { id: string; section: 'fixed' | 'variable' | 'saving' | 'loan'; itemName?: string; category?: string; amount: number; actualAmount?: number; transferDay?: number }
export type MonthlyData = { expectedIncome: number; budgets: Budget[]; transactions: Transaction[] }

export const categories = ['식비/외식비', '생필품비', '교육/문화비', '교통/유류비', '미용/의료비 등 기타']
export const collectionPath = (uid: string, name: string) => collection(db!, 'users', uid, name)

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

export const noop = addDoc // keeps Firebase tree-shaking compatible

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

export type TimeCategory = {
  id: string
  name: string
  color: string
}

export type TimeTodo = {
  id: string
  categoryId: string
  title: string
  durationHours: number // 1, 2, 3 etc. (can be 0.5, 1.5)
  completed?: boolean
  isBufferTask?: boolean // 보충시간으로 이관된 할일
  note?: string
}

export type WeeklyTimeBlock = {
  id: string
  todoId?: string
  title: string
  categoryId: string
  dayOfWeek: number // 0: 월, 1: 화, 2: 수, 3: 목, 4: 금, 5: 토, 6: 일
  startHour: number // 5 ~ 23
  durationHours: number // 1, 2, 3 ...
  color?: string
}

export type DailyFeedbackBlock = {
  id: string
  date: string // YYYY-MM-DD
  startHour: number // 5 ~ 23
  endHour: number // 6 ~ 24
  title: string
  categoryId: string
  status: 'done' | 'partial' | 'failed'
  reflection?: string
  movedToBuffer?: boolean // 보충시간으로 전송 여부
}

export type DailySummary = {
  date: string
  reviewMemo?: string
}

export type TimeSpendingData = {
  categories: TimeCategory[]
  todos: TimeTodo[]
  weeklyPlanners: Record<string, WeeklyTimeBlock[]> // key: yearWeek (e.g., '2026-W41')
  dailyFeedbacks: Record<string, DailyFeedbackBlock[]> // key: dateStr (e.g., '2026-10-11')
  dailySummaries?: Record<string, DailySummary>
}

export const defaultTimeCategories: TimeCategory[] = [
  { id: 'cat-exercise', name: '운동', color: '#10b981' }, // 에메랄드 그린
  { id: 'cat-work', name: '일', color: '#3b82f6' },       // 블루
  { id: 'cat-family', name: '가정', color: '#f59e0b' },   // 앰버/오렌지
  { id: 'cat-buffer', name: '보충시간', color: '#8b5cf6' },// 보라/바이올렛
  { id: 'cat-rest', name: '쉼', color: '#ec4899' },       // 핑크
]

export const defaultTimeSpendingData: TimeSpendingData = {
  categories: defaultTimeCategories,
  todos: [
    { id: 'todo-1', categoryId: 'cat-exercise', title: '헬스 & 유산소 운동', durationHours: 1.5 },
    { id: 'todo-2', categoryId: 'cat-work', title: '핵심 업무 & 기획서 작성', durationHours: 2 },
    { id: 'todo-3', categoryId: 'cat-family', title: '가족과 저녁 식사 및 대화', durationHours: 2 },
    { id: 'todo-4', categoryId: 'cat-buffer', title: '미완료 업무 보충 처리', durationHours: 1 },
    { id: 'todo-5', categoryId: 'cat-rest', title: '독서 및 명상 휴식', durationHours: 1 },
  ],
  weeklyPlanners: {},
  dailyFeedbacks: {},
  dailySummaries: {}
}

// 주차 계산 유틸리티 (ISO 8601 기준 월요일 시작)
export function getYearWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  // 목요일 기준으로 주차 산정
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// 해당 주의 월요일 구하기
export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // 0은 일요일이므로 -6
  return new Date(date.setDate(diff))
}

// 주의 요일별 날짜 정보 배열 구하기 (월~일)
export function getDaysOfWeek(monday: Date): { dayIndex: number; name: string; dateStr: string; displayStr: string; isToday: boolean }[] {
  const dayNames = ['월', '화', '수', '목', '금', '토', '일']
  const todayStr = new Date().toISOString().split('T')[0]

  return dayNames.map((name, i) => {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`

    return {
      dayIndex: i,
      name,
      dateStr,
      displayStr: `${m}.${d} (${name})`,
      isToday: dateStr === todayStr
    }
  })
}

// 시간 레이블 포맷 (예: 5 -> 05:00, 12 -> 12:00, 24 -> 24:00)
export function formatHour(hour: number): string {
  const h = String(hour).padStart(2, '0')
  return `${h}:00`
}

// Firestore 로드
export async function loadTimeSpendingFromFirestore(phone: string): Promise<TimeSpendingData | null> {
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'userTimeSpending', phone))
    if (snap.exists()) {
      const data = snap.data() as TimeSpendingData
      return {
        categories: data.categories?.length ? data.categories : defaultTimeCategories,
        todos: data.todos || [],
        weeklyPlanners: data.weeklyPlanners || {},
        dailyFeedbacks: data.dailyFeedbacks || {},
        dailySummaries: data.dailySummaries || {}
      }
    }
    return null
  } catch (err) {
    console.error('Failed to load Time Spending from Firestore:', err)
    return null
  }
}

// Firestore 저장
export async function saveTimeSpendingToFirestore(phone: string, data: TimeSpendingData) {
  if (!db) return
  try {
    await setDoc(doc(db, 'userTimeSpending', phone), data, { merge: true })
  } catch (err) {
    console.error('Failed to save Time Spending to Firestore:', err)
  }
}

'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertCircle,
  Sparkles,
  ArrowRight,
  GripVertical,
  Calendar,
  RotateCcw,
  CheckCircle2,
  CalendarCheck,
  Layers,
  BarChart2
} from 'lucide-react'
import {
  TimeCategory,
  TimeTodo,
  WeeklyTimeBlock,
  DailyFeedbackBlock,
  TimeSpendingData,
  defaultTimeCategories,
  getYearWeek,
  getMondayOfWeek,
  getDaysOfWeek,
  formatHour
} from '@/lib/timeSpending'

type Props = {
  data: TimeSpendingData
  onUpdate: (data: TimeSpendingData) => void
}

const uid = () => Math.random().toString(36).slice(2, 9)

// 05:00부터 24:00까지의 30분 단위 시간 슬롯 리스트 (5.0 ~ 23.5, 총 38개 슬롯)
const TIME_SLOTS = Array.from({ length: 38 }, (_, i) => 5 + i * 0.5)

const PRESET_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b'  // slate
]

// 0.5시간부터 12시간까지 0.5시간 단위 옵션 (총 24개)
const DURATION_OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 0.5)


export default function TimeSpendingView({ data, onUpdate }: Props) {
  // 활성 서브 네비게이션 탭 (전체 흐름 or 개별 집중 모드)
  const [activeTab, setActiveTab] = useState<'all' | 'todos' | 'weekly' | 'daily'>('all')

  // 1. 카테고리 관리 상태
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(PRESET_COLORS[0])

  // 투두 입력 상태
  const [activeCategoryId, setActiveCategoryId] = useState<string>(data.categories[0]?.id || 'cat-exercise')
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoHours, setNewTodoHours] = useState<number>(1)

  // 2. 위클리 플래너 상태
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(() => new Date())
  const currentWeekKey = useMemo(() => getYearWeek(currentWeekDate), [currentWeekDate])
  const monday = useMemo(() => getMondayOfWeek(currentWeekDate), [currentWeekDate])
  const daysOfWeek = useMemo(() => getDaysOfWeek(monday), [monday])

  // 주차 이동
  const changeWeek = (offset: number) => {
    const nextDate = new Date(currentWeekDate)
    nextDate.setDate(nextDate.getDate() + offset * 7)
    setCurrentWeekDate(nextDate)
  }

  const goCurrentWeek = () => {
    setCurrentWeekDate(new Date())
  }

  // 3. 원데이 피드백 상태
  const [feedbackDateStr, setFeedbackDateStr] = useState<string>(() => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  // 피드백 입력 모달 / 드래그 선택 상태
  const [isSelectingTime, setIsSelectingTime] = useState(false)
  const [selectionStartHour, setSelectionStartHour] = useState<number | null>(null)
  const [selectionEndHour, setSelectionEndHour] = useState<number | null>(null)
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false)
  const [editingFeedbackBlock, setEditingFeedbackBlock] = useState<DailyFeedbackBlock | null>(null)
  const [feedbackTitle, setFeedbackTitle] = useState('')
  const [feedbackCategory, setFeedbackCategory] = useState('')
  const [feedbackStatus, setFeedbackStatus] = useState<'done' | 'partial' | 'failed'>('done')
  const [feedbackMemo, setFeedbackMemo] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // 위클리 플래너 30분 단위 정밀 드래그 앤 드롭 상태
  const [draggingItem, setDraggingItem] = useState<{
    todoId?: string
    title: string
    categoryId: string
    durationHours: number
    fromBlockId?: string
  } | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<{
    dayIndex: number
    slot: number
  } | null>(null)
  const dragGhostRef = useRef<HTMLDivElement | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 3500)
  }

  // 데이터 헬퍼
  const categories = data.categories || defaultTimeCategories
  const todos = data.todos || []
  const weeklyBlocks = data.weeklyPlanners?.[currentWeekKey] || []
  const dailyBlocks = data.dailyFeedbacks?.[feedbackDateStr] || []

  // 선택한 피드백 날짜가 속한 주차 및 요일 인덱스
  const feedbackDateObj = useMemo(() => new Date(`${feedbackDateStr}T00:00:00`), [feedbackDateStr])
  const feedbackWeekKey = useMemo(() => getYearWeek(feedbackDateObj), [feedbackDateObj])
  const feedbackDayIndex = useMemo(() => {
    const day = feedbackDateObj.getDay()
    return day === 0 ? 6 : day - 1 // 월(0) ~ 일(6)
  }, [feedbackDateObj])

  // 해당 피드백 날짜에 해당하는 위클리 플래너의 계획 블록들
  const feedbackDayWeeklyBlocks = useMemo(() => {
    const blocks = data.weeklyPlanners?.[feedbackWeekKey] || []
    return blocks.filter(b => b.dayOfWeek === feedbackDayIndex)
  }, [data.weeklyPlanners, feedbackWeekKey, feedbackDayIndex])

  // --- 카테고리 & 투두 CRUD 핸들러 ---
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return
    const newCat: TimeCategory = {
      id: `cat-${uid()}`,
      name: newCategoryName.trim(),
      color: newCategoryColor
    }
    const updated = {
      ...data,
      categories: [...categories, newCat]
    }
    onUpdate(updated)
    setNewCategoryName('')
    setActiveCategoryId(newCat.id)
    showToast(`'${newCat.name}' 카테고리가 추가되었습니다.`)
  }

  const handleUpdateCategory = (id: string) => {
    if (!editingCategoryName.trim()) return
    const updated = {
      ...data,
      categories: categories.map(c => c.id === id ? { ...c, name: editingCategoryName.trim() } : c)
    }
    onUpdate(updated)
    setEditingCategoryId(null)
    showToast('카테고리명이 수정되었습니다.')
  }

  const handleDeleteCategory = (id: string) => {
    if (categories.length <= 1) {
      alert('최소 1개 이상의 카테고리가 필요합니다.')
      return
    }
    if (confirm('이 카테고리를 삭제하시겠습니까? 관련된 투두리스트도 함께 정리됩니다.')) {
      const updated = {
        ...data,
        categories: categories.filter(c => c.id !== id),
        todos: todos.filter(t => t.categoryId !== id)
      }
      onUpdate(updated)
      if (activeCategoryId === id) {
        setActiveCategoryId(updated.categories[0].id)
      }
      showToast('카테고리가 삭제되었습니다.')
    }
  }

  const handleAddTodo = () => {
    if (!newTodoTitle.trim()) return
    const newTodo: TimeTodo = {
      id: `todo-${uid()}`,
      categoryId: activeCategoryId,
      title: newTodoTitle.trim(),
      durationHours: Number(newTodoHours) || 1
    }
    const updated = {
      ...data,
      todos: [...todos, newTodo]
    }
    onUpdate(updated)
    setNewTodoTitle('')
    showToast(`'${newTodo.title}' (${newTodo.durationHours}시간) 할일이 추가되었습니다.`)
  }

  const handleDeleteTodo = (id: string) => {
    const updated = {
      ...data,
      todos: todos.filter(t => t.id !== id)
    }
    onUpdate(updated)
    showToast('할일이 삭제되었습니다.')
  }

  // --- 위클리 플래너 핸들러 ---
  // 지난주 플래너 복사
  const handleCopyLastWeek = () => {
    const prevDate = new Date(currentWeekDate)
    prevDate.setDate(prevDate.getDate() - 7)
    const prevWeekKey = getYearWeek(prevDate)
    const prevBlocks = data.weeklyPlanners?.[prevWeekKey] || []

    if (!prevBlocks.length) {
      alert('지난 주에 등록된 플래너 일정이 없습니다.')
      return
    }

    if (weeklyBlocks.length > 0 && !confirm('이번 주에 이미 일정이 있습니다. 지난주 일정으로 덮어쓸까요?')) {
      return
    }

    const clonedBlocks = prevBlocks.map(b => ({
      ...b,
      id: `wb-${uid()}`
    }))

    const updated = {
      ...data,
      weeklyPlanners: {
        ...data.weeklyPlanners,
        [currentWeekKey]: clonedBlocks
      }
    }
    onUpdate(updated)
    showToast(`지난주(${prevWeekKey}) 일정 ${clonedBlocks.length}개를 이번 주로 복사했습니다!`)
  }

  // 드래그 시작 시 마우스 커서 위치와 30분 슬롯이 정확히 일치하도록 컴팩트 고스트 이미지 설정
  const startDragWithItem = (
    e: React.DragEvent,
    payload: {
      todoId?: string
      title: string
      categoryId: string
      durationHours: number
      fromBlockId?: string
    }
  ) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
    if (dragGhostRef.current) {
      const cat = categories.find(c => c.id === payload.categoryId)
      dragGhostRef.current.style.backgroundColor = cat?.color || '#3b82f6'
      dragGhostRef.current.textContent = `${payload.title} (${payload.durationHours}h)`
      // 마우스 커서가 막대 상단/중앙(14px)에 정확히 위치하도록 고정해 6:30 행에 넣을 때 7:00으로 밀리지 않게 함
      e.dataTransfer.setDragImage(dragGhostRef.current, 24, 14)
    }
    // 브라우저가 dragStart 직후 DOM 변경으로 드래그를 취소하지 않도록 requestAnimationFrame으로 상태 반영
    requestAnimationFrame(() => {
      setDraggingItem(payload)
    })
  }

  // 드래그 앤 드롭: 투두 막대 잡기
  const handleDragStart = (e: React.DragEvent, todo: TimeTodo) => {
    startDragWithItem(e, {
      todoId: todo.id,
      title: todo.title,
      categoryId: todo.categoryId,
      durationHours: todo.durationHours
    })
  }

  const handleDragEnd = () => {
    setDraggingItem(null)
    setDragOverTarget(null)
  }

  // 드롭 타겟 (요일 dayIndex, 시작 시간 startHour - 0.5시간=30분 단위)
  const handleDropOnSlot = (e: React.DragEvent, dayIndex: number, startHour: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverTarget(null)
    setDraggingItem(null)
    try {
      const raw = e.dataTransfer.getData('application/json')
      const item = raw
        ? (JSON.parse(raw) as {
            todoId?: string
            title: string
            categoryId: string
            durationHours: number
            fromBlockId?: string
          })
        : draggingItem
      if (!item) return

      // 30분(0.5시간) 단위로 정확히 스냅
      const snappedStartHour = Math.round(startHour * 2) / 2

      // 최대 24시 초과 방지
      const clampedDuration = Math.min(item.durationHours, 24 - snappedStartHour)
      if (clampedDuration <= 0) return

      const newBlock: WeeklyTimeBlock = {
        id: `wb-${uid()}`,
        todoId: item.todoId,
        title: item.title,
        categoryId: item.categoryId,
        dayOfWeek: dayIndex,
        startHour: snappedStartHour,
        durationHours: clampedDuration
      }

      let nextBlocks = weeklyBlocks
      if (item.fromBlockId) {
        // 이미 배치된 블록을 다른 슬롯으로 옮길 때 이전 블록 제거
        nextBlocks = nextBlocks.filter(b => b.id !== item.fromBlockId)
      }

      const updated = {
        ...data,
        weeklyPlanners: {
          ...data.weeklyPlanners,
          [currentWeekKey]: [...nextBlocks, newBlock]
        }
      }
      onUpdate(updated)
      showToast(`${daysOfWeek[dayIndex].name}요일 ${formatHour(snappedStartHour)} ~ ${formatHour(snappedStartHour + clampedDuration)}에 배치되었습니다!`)
    } catch (err) {
      console.error(err)
    }
  }

  // 배치된 블록 30분 단위 미세 이동 (-0.5h / +0.5h)
  const handleShiftWeeklyBlock = (id: string, deltaHours: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = weeklyBlocks.find(b => b.id === id)
    if (!target) return
    const nextStart = Math.round((target.startHour + deltaHours) * 2) / 2
    if (nextStart < 5 || nextStart + target.durationHours > 24) return

    const updated = {
      ...data,
      weeklyPlanners: {
        ...data.weeklyPlanners,
        [currentWeekKey]: weeklyBlocks.map(b =>
          b.id === id ? { ...b, startHour: nextStart } : b
        )
      }
    }
    onUpdate(updated)
    showToast(`${formatHour(nextStart)} ~ ${formatHour(nextStart + target.durationHours)}으로 이동했습니다.`)
  }

  const handleDeleteWeeklyBlock = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const updated = {
      ...data,
      weeklyPlanners: {
        ...data.weeklyPlanners,
        [currentWeekKey]: weeklyBlocks.filter(b => b.id !== id)
      }
    }
    onUpdate(updated)
    showToast('플래너에서 일정을 제거했습니다.')
  }

  // --- 원데이 피드백 핸들러 ---
  // 마우스로 시간대 드래그(긁어서) 선택 (30분 단위)
  const handleMouseDownFeedback = (slot: number) => {
    setIsSelectingTime(true)
    setSelectionStartHour(slot)
    setSelectionEndHour(slot + 0.5)
  }

  const handleMouseEnterFeedback = (slot: number) => {
    if (!isSelectingTime || selectionStartHour === null) return
    if (slot >= selectionStartHour) {
      setSelectionEndHour(slot + 0.5)
    } else {
      setSelectionEndHour(slot)
    }
  }

  const handleMouseUpFeedback = () => {
    if (!isSelectingTime || selectionStartHour === null || selectionEndHour === null) {
      setIsSelectingTime(false)
      return
    }
    setIsSelectingTime(false)
    const start = Math.min(selectionStartHour, selectionEndHour)
    const end = Math.max(selectionStartHour, selectionEndHour)

    // 팝업 열기
    setEditingFeedbackBlock(null)
    setFeedbackTitle('')
    setFeedbackCategory(categories[0]?.id || '')
    setFeedbackStatus('done')
    setFeedbackMemo('')
    setSelectionStartHour(start)
    setSelectionEndHour(end)
    setFeedbackModalOpen(true)
  }

  // 실제 한 일 피드백 저장
  const handleSaveFeedbackBlock = () => {
    if (!feedbackTitle.trim() || selectionStartHour === null || selectionEndHour === null) return

    const start = selectionStartHour
    const end = selectionEndHour

    let updatedBlocks: DailyFeedbackBlock[] = []

    if (editingFeedbackBlock) {
      updatedBlocks = dailyBlocks.map(b =>
        b.id === editingFeedbackBlock.id
          ? {
              ...b,
              title: feedbackTitle.trim(),
              categoryId: feedbackCategory,
              startHour: start,
              endHour: end,
              status: feedbackStatus,
              reflection: feedbackMemo
            }
          : b
      )
    } else {
      const newBlock: DailyFeedbackBlock = {
        id: `dfb-${uid()}`,
        date: feedbackDateStr,
        startHour: start,
        endHour: end,
        title: feedbackTitle.trim(),
        categoryId: feedbackCategory,
        status: feedbackStatus,
        reflection: feedbackMemo
      }
      updatedBlocks = [...dailyBlocks, newBlock]
    }

    const updated = {
      ...data,
      dailyFeedbacks: {
        ...data.dailyFeedbacks,
        [feedbackDateStr]: updatedBlocks
      }
    }
    onUpdate(updated)
    setFeedbackModalOpen(false)
    showToast('실행 피드백이 기록되었습니다.')
  }

  const handleDeleteFeedbackBlock = (id: string) => {
    const updated = {
      ...data,
      dailyFeedbacks: {
        ...data.dailyFeedbacks,
        [feedbackDateStr]: dailyBlocks.filter(b => b.id !== id)
      }
    }
    onUpdate(updated)
    showToast('피드백 일정이 삭제되었습니다.')
  }

  // 🌟 핵심 요구사항: "여기서 못한거 보충시간에 넣기도 하고 수정하려고"
  // 못하거나 지연된 일을 '보충시간' 카테고리의 투두로 즉시 등록!
  const handleMoveToBufferTask = (block: DailyFeedbackBlock | { title: string; categoryId: string }) => {
    // 1. '보충시간' 카테고리 찾기 (없으면 'cat-buffer' 또는 새로 생성)
    let bufferCat = categories.find(c => c.name.includes('보충') || c.id === 'cat-buffer')
    let currentCats = [...categories]

    if (!bufferCat) {
      bufferCat = {
        id: 'cat-buffer',
        name: '보충시간',
        color: '#8b5cf6'
      }
      currentCats.push(bufferCat)
    }

    const duration = 'endHour' in block ? Math.max(1, block.endHour - block.startHour) : 1
    const newBufferTodo: TimeTodo = {
      id: `todo-${uid()}`,
      categoryId: bufferCat.id,
      title: `[보충] ${block.title}`,
      durationHours: duration,
      isBufferTask: true,
      note: `${feedbackDateStr} 피드백에서 미완료 이관`
    }

    // 피드백 블록이 존재할 경우 movedToBuffer 표시
    let updatedDaily = { ...data.dailyFeedbacks }
    if ('id' in block) {
      updatedDaily[feedbackDateStr] = dailyBlocks.map(b =>
        b.id === block.id ? { ...b, movedToBuffer: true, status: 'failed' } : b
      )
    }

    const updated = {
      ...data,
      categories: currentCats,
      todos: [...todos, newBufferTodo],
      dailyFeedbacks: updatedDaily
    }
    onUpdate(updated)
    if (feedbackModalOpen) setFeedbackModalOpen(false)
    showToast(`⚡ '${block.title}'이(가) [보충시간] 투두리스트에 추가되었습니다!`)
  }

  // 통계 계산: 주간 총 계획 시간 및 카테고리별 시간
  const weeklyStats = useMemo(() => {
    const catMap: Record<string, number> = {}
    let total = 0
    weeklyBlocks.forEach(b => {
      catMap[b.categoryId] = (catMap[b.categoryId] || 0) + b.durationHours
      total += b.durationHours
    })
    return { catMap, total }
  }, [weeklyBlocks])

  // 통계 계산: 오늘 계획 vs 실제 시간
  const dailyStats = useMemo(() => {
    let plannedHours = 0
    feedbackDayWeeklyBlocks.forEach(b => {
      plannedHours += b.durationHours
    })
    let actualHours = 0
    dailyBlocks.forEach(b => {
      actualHours += Math.max(0, b.endHour - b.startHour)
    })
    return { plannedHours, actualHours }
  }, [feedbackDayWeeklyBlocks, dailyBlocks])

  return (
    <div className="space-y-8 pb-16">
      {/* 드래그 시 커서와 30분 슬롯이 정확히 일치하도록 돕는 1슬롯 높이(28px) 컴팩트 고스트 */}
      <div
        ref={dragGhostRef}
        className="fixed -top-96 -left-96 z-50 flex h-7 items-center rounded-lg px-3 text-xs font-bold text-white shadow-lg pointer-events-none whitespace-nowrap"
      />

      {/* 토스트 알림 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 상단 헤더 & 서브 네비게이션 */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
              <Clock className="h-3.5 w-3.5" />
              <span>TIME MANAGEMENT SYSTEM</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
              시간소비
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              투두리스트 시간 분배부터 위클리 플래너 드래그 배치, 실제 실행 원데이 피드백까지 한곳에서 관리하세요.
            </p>
          </div>

          {/* 뷰 탭 전환 버튼 */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-neutral-100 p-1.5 text-xs font-medium text-neutral-600">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-xl px-3 py-2 transition ${
                activeTab === 'all'
                  ? 'bg-white font-semibold text-neutral-900 shadow-sm'
                  : 'hover:text-neutral-900'
              }`}
            >
              전체 보기
            </button>
            <button
              onClick={() => setActiveTab('todos')}
              className={`rounded-xl px-3 py-2 transition ${
                activeTab === 'todos'
                  ? 'bg-white font-semibold text-neutral-900 shadow-sm'
                  : 'hover:text-neutral-900'
              }`}
            >
              # 투드리스트 분배
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`rounded-xl px-3 py-2 transition ${
                activeTab === 'weekly'
                  ? 'bg-white font-semibold text-neutral-900 shadow-sm'
                  : 'hover:text-neutral-900'
              }`}
            >
              # 위클리플래너
            </button>
            <button
              onClick={() => setActiveTab('daily')}
              className={`rounded-xl px-3 py-2 transition ${
                activeTab === 'daily'
                  ? 'bg-white font-semibold text-neutral-900 shadow-sm'
                  : 'hover:text-neutral-900'
              }`}
            >
              # 원데이 피드백
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. # 투드리스트 분배 (Todo Distribution) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'todos') && (
        <section className="space-y-6 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-700">
                  1
                </span>
                <h2 className="text-xl font-bold text-neutral-900">
                  투드리스트 분배
                </h2>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                가로축 카테고리를 설정하고, 세로축에 투두리스트와 소요시간을 입력하면 시간에 비례하는 막대가 생성됩니다.
              </p>
            </div>
            <div className="text-xs text-neutral-400">
              * 생성된 막대를 마우스로 잡아 아래 위클리 플래너로 끌어놓을 수 있습니다.
            </div>
          </div>

          {/* 가로축 카테고리 설정 바 (기본: 운동, 일, 가정, 보충시간, 쉼 + 자유 추가/수정) */}
          <div>
            <div className="mb-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              가로축 · 카테고리 목록 (클릭하여 투두 추가 / 수정 가능)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(cat => {
                const isActive = activeCategoryId === cat.id
                const isEditing = editingCategoryId === cat.id
                const count = todos.filter(t => t.categoryId === cat.id).length

                return (
                  <div
                    key={cat.id}
                    className={`group relative flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm transition ${
                      isActive
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-sm'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-800 hover:border-neutral-300 hover:bg-neutral-100'
                    }`}
                  >
                    {/* 카테고리 컬러 인디케이터 */}
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />

                    {isEditing ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingCategoryName}
                          onChange={e => setEditingCategoryName(e.target.value)}
                          className="w-20 rounded bg-white px-1.5 py-0.5 text-xs text-neutral-900 focus:outline-none"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleUpdateCategory(cat.id)
                            if (e.key === 'Escape') setEditingCategoryId(null)
                          }}
                        />
                        <button
                          onClick={() => handleUpdateCategory(cat.id)}
                          className="rounded p-1 hover:bg-neutral-700 text-emerald-400"
                          title="저장"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCategoryId(null)}
                          className="rounded p-1 hover:bg-neutral-700 text-neutral-300"
                          title="취소"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveCategoryId(cat.id)}
                        className="font-medium"
                      >
                        {cat.name}
                        <span
                          className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[11px] ${
                            isActive
                              ? 'bg-neutral-800 text-neutral-300'
                              : 'bg-neutral-200 text-neutral-600'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    )}

                    {/* 카테고리 이름 수정 및 삭제 버튼 */}
                    {!isEditing && (
                      <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setEditingCategoryId(cat.id)
                            setEditingCategoryName(cat.name)
                          }}
                          className={`p-1 rounded hover:bg-neutral-200/50 ${isActive ? 'hover:bg-neutral-700' : ''}`}
                          title="카테고리명 수정"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            handleDeleteCategory(cat.id)
                          }}
                          className={`p-1 rounded hover:bg-neutral-200/50 ${isActive ? 'hover:bg-neutral-700 text-red-300' : 'text-red-500'}`}
                          title="카테고리 삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* 빈칸 자기가 넣으면 되는 새 카테고리 추가 인풋 */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 p-1 pl-2">
                <input
                  type="text"
                  placeholder="+ 새 카테고리 입력"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCategory()
                  }}
                  className="w-28 bg-transparent text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none"
                />
                <select
                  value={newCategoryColor}
                  onChange={e => setNewCategoryColor(e.target.value)}
                  className="rounded bg-transparent text-xs text-neutral-600 focus:outline-none cursor-pointer"
                  title="색상 선택"
                >
                  {PRESET_COLORS.map(c => (
                    <option key={c} value={c} style={{ color: c }}>
                      ■
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddCategory}
                  className="flex h-7 w-7 items-center justify-center rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition"
                  title="카테고리 추가"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* 세로축: 투두리스트 작성 및 소요시간 입력 박스 */}
          <div className="rounded-2xl border border-neutral-200/90 bg-neutral-50/50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-700">
                  선택된 카테고리:
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
                  style={{
                    backgroundColor:
                      categories.find(c => c.id === activeCategoryId)?.color || '#3b82f6'
                  }}
                >
                  {categories.find(c => c.id === activeCategoryId)?.name}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  placeholder="세로축 투두리스트 내용 입력 (예: 웨이트 트레이닝, 보고서 작성)"
                  value={newTodoTitle}
                  onChange={e => setNewTodoTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddTodo()
                  }}
                  className="flex-1 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:border-neutral-900 focus:outline-none"
                />

                {/* 소요시간 선택 드롭다운 (0.5시간 ~ 12시간) */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-600 flex-shrink-0">소요시간:</span>
                  <select
                    value={newTodoHours}
                    onChange={e => setNewTodoHours(Number(e.target.value))}
                    className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 focus:border-neutral-900 focus:outline-none cursor-pointer shadow-xs hover:border-neutral-400 transition"
                  >
                    {DURATION_OPTIONS.map(h => (
                      <option key={h} value={h}>
                        {h % 1 === 0 ? `${h}시간` : `${h}시간 (${Math.floor(h) > 0 ? `${Math.floor(h)}시간 30분` : '30분'})`}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleAddTodo}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    <span>추가</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 막대 형성 영역: "그러면 아래 막대가 형성됨(막대는 1시간짜리는 가로축1시간짜리고 2시간짜리는 가로축이2시간짜리로 형성이 됨" */}
          {/* ============================================================== */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-neutral-700" />
                <h3 className="text-sm font-bold text-neutral-800">
                  생성된 시간 막대 (시간에 비례하는 가로 길이 · 드래그하여 플래너에 배치)
                </h3>
              </div>
              <span className="text-xs text-neutral-500">
                총 {todos.length}개의 할일 블록 | 기준 너비: 1시간 = 90px
              </span>
            </div>

            {todos.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 py-10 text-center">
                <Clock className="h-8 w-8 text-neutral-300" />
                <p className="mt-2 text-sm font-medium text-neutral-600">
                  아직 등록된 투두리스트가 없습니다.
                </p>
                <p className="text-xs text-neutral-400">
                  위에서 카테고리를 선택하고 할일과 소요시간을 추가해보세요.
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-2xl border border-neutral-200/80 bg-neutral-50/70 p-4">
                <div className="flex flex-wrap gap-3">
                  {todos.map(todo => {
                    const cat = categories.find(c => c.id === todo.categoryId) || {
                      name: '기타',
                      color: '#64748b'
                    }

                    // 1시간 = 90px 비례 가로축 너비
                    const barWidth = Math.max(90, Math.round(todo.durationHours * 90))

                    // 이번 주 위클리 플래너에 배치되었는지 확인
                    const placedBlocks = weeklyBlocks.filter(b => b.todoId === todo.id)
                    const isPlaced = placedBlocks.length > 0

                    return (
                      <div
                        key={todo.id}
                        draggable
                        onDragStart={e => handleDragStart(e, todo)}
                        onDragEnd={handleDragEnd}
                        style={{
                          width: `${barWidth}px`,
                          borderColor: cat.color,
                          backgroundColor: `${cat.color}15`
                        }}
                        className="group relative flex cursor-grab active:cursor-grabbing flex-col justify-between rounded-xl border-2 p-2.5 shadow-sm transition hover:scale-[1.02] hover:shadow-md select-none"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-700" />
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            <span className="text-[11px] font-semibold text-neutral-600">
                              {cat.name}
                            </span>
                          </div>

                          <button
                            onClick={() => handleDeleteTodo(todo.id)}
                            className="rounded p-0.5 text-neutral-400 hover:bg-white hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                            title="삭제"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="my-1.5 truncate text-xs font-bold text-neutral-900" title={todo.title}>
                          {todo.title}
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className="rounded-md px-1.5 py-0.5 font-bold text-white shadow-xs"
                            style={{ backgroundColor: cat.color }}
                          >
                            {todo.durationHours}시간 ({barWidth}px)
                          </span>

                          {isPlaced ? (
                            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" /> 배치됨
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400">
                              드래그
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. # 위클리플래너 (Weekly Planner) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'weekly') && (
        <section className="space-y-6 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-neutral-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold text-blue-700">
                  2
                </span>
                <h2 className="text-xl font-bold text-neutral-900">
                  위클리플래너
                </h2>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                위에서 형성된 시간 막대를 월화수목금토일 플래너로 끌어서 넣으세요. am5시부터 pm12시까지 30분 단위로 한 화면에 펼쳐집니다.
              </p>
            </div>

            {/* 주차 네비게이션 & 지난주꺼 복사 & 누적 조회 */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-1">
                <button
                  onClick={() => changeWeek(-1)}
                  className="rounded-xl p-1.5 text-neutral-700 hover:bg-neutral-200 transition"
                  title="지난주 플래너 보기"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs font-bold text-neutral-800">
                  {currentWeekKey} ({daysOfWeek[0]?.displayStr} ~ {daysOfWeek[6]?.displayStr})
                </span>
                <button
                  onClick={() => changeWeek(1)}
                  className="rounded-xl p-1.5 text-neutral-700 hover:bg-neutral-200 transition"
                  title="다음주 플래너 보기"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={goCurrentWeek}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
              >
                이번주
              </button>

              {/* 지난주꺼 복사 버튼 */}
              <button
                onClick={handleCopyLastWeek}
                className="flex items-center gap-1.5 rounded-xl bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-neutral-800 transition"
                title="지난주에 배치된 계획 블록을 이번 주로 복사합니다"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>지난주 꺼 복사</span>
              </button>
            </div>
          </div>

          {/* 주간 시간 분배 요약 바 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-50 p-3.5 text-xs">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-neutral-500" />
              <span className="font-semibold text-neutral-700">이번 주 총 계획 시간:</span>
              <span className="rounded-lg bg-neutral-900 px-2 py-0.5 font-bold text-white">
                {weeklyStats.total}시간
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {categories.map(cat => {
                const hours = weeklyStats.catMap[cat.id] || 0
                if (hours === 0) return null
                return (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-white shadow-xs"
                    style={{ backgroundColor: cat.color }}
                  >
                    <span>{cat.name}</span>
                    <span className="opacity-90">{hours}h</span>
                  </span>
                )
              })}
            </div>
          </div>

          {/* ============================================================== */}
          {/* 위클리 플래너 시간대별 그리드 테이블 (05:00 ~ 24:00, 월~일) */}
          {/* ============================================================== */}
          <div
            className="overflow-x-auto rounded-2xl border border-neutral-200"
            onDragLeave={e => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverTarget(null)
              }
            }}
          >
            <table className="min-w-[850px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80 text-xs text-neutral-600">
                  <th className="w-16 p-2.5 text-center font-bold text-neutral-500 border-r border-neutral-200">
                    시간
                  </th>
                  {daysOfWeek.map(d => (
                    <th
                      key={d.dayIndex}
                      className={`p-2.5 text-center font-bold border-r last:border-r-0 border-neutral-200 ${
                        d.isToday ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{d.name}요일</span>
                        <span className="text-[11px] font-normal text-neutral-400">
                          ({d.dateStr.slice(5)})
                        </span>
                        {d.isToday && (
                          <span className="rounded bg-blue-600 px-1 py-0.2 text-[9px] text-white">
                            오늘
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map(slot => {
                  const isHourStart = slot % 1 === 0
                  const isTimeHighlighted =
                    dragOverTarget !== null && Math.abs(dragOverTarget.slot - slot) < 0.01

                  return (
                    <tr
                      key={slot}
                      className={`transition ${
                        isHourStart
                          ? 'border-b border-neutral-200/80'
                          : 'border-b border-dashed border-neutral-200/60'
                      }`}
                    >
                      {/* 시간 축 (05:00 ~ 24:00, 30분 단위) */}
                      <td
                        className={`w-16 p-1 text-center border-r border-neutral-200 select-none transition ${
                          isTimeHighlighted
                            ? 'bg-blue-600 text-[11px] font-bold text-white'
                            : isHourStart
                            ? 'bg-neutral-50/80 text-[11px] font-bold text-neutral-800'
                            : 'bg-neutral-50/30 text-[10px] font-medium text-neutral-500'
                        }`}
                      >
                        {formatHour(slot)}
                      </td>

                      {/* 월~일 각 요일 셀 */}
                      {daysOfWeek.map(d => {
                        // 이 셀에서 시작하는 블록
                        const startBlock = weeklyBlocks.find(
                          b => b.dayOfWeek === d.dayIndex && Math.abs(b.startHour - slot) < 0.01
                        )
                        // 이 셀이 다른 블록의 점유 범위 내에 있는지 확인
                        const isOccupiedByPrev = weeklyBlocks.some(
                          b =>
                            b.dayOfWeek === d.dayIndex &&
                            b.startHour < slot &&
                            slot < b.startHour + b.durationHours
                        )

                        const cat = startBlock
                          ? categories.find(c => c.id === startBlock.categoryId)
                          : null

                        const slotCount = startBlock ? Math.round(startBlock.durationHours * 2) : 0
                        const isBeingDragged =
                          draggingItem?.fromBlockId && startBlock?.id === draggingItem.fromBlockId

                        // 드래그 중 현재 셀이 드롭 시작점인지 / 드롭 범위에 포함되는지 확인
                        const isDropStart =
                          dragOverTarget !== null &&
                          dragOverTarget.dayIndex === d.dayIndex &&
                          Math.abs(dragOverTarget.slot - slot) < 0.01
                        const previewDuration = draggingItem
                          ? Math.min(draggingItem.durationHours, 24 - slot)
                          : 0.5
                        const previewSlotCount = Math.max(1, Math.round(previewDuration * 2))
                        const previewCat = draggingItem
                          ? categories.find(c => c.id === draggingItem.categoryId)
                          : null
                        const isInDropRange =
                          dragOverTarget !== null &&
                          draggingItem !== null &&
                          dragOverTarget.dayIndex === d.dayIndex &&
                          slot >= dragOverTarget.slot &&
                          slot < Math.min(24, dragOverTarget.slot + draggingItem.durationHours)

                        return (
                          <td
                            key={d.dayIndex}
                            onDragEnter={e => {
                              e.preventDefault()
                              setDragOverTarget({ dayIndex: d.dayIndex, slot })
                            }}
                            onDragOver={e => {
                              e.preventDefault()
                              e.dataTransfer.dropEffect = 'move'
                              if (
                                !dragOverTarget ||
                                dragOverTarget.dayIndex !== d.dayIndex ||
                                Math.abs(dragOverTarget.slot - slot) > 0.01
                              ) {
                                setDragOverTarget({ dayIndex: d.dayIndex, slot })
                              }
                            }}
                            onDrop={e => handleDropOnSlot(e, d.dayIndex, slot)}
                            className={`relative h-8 p-0.5 border-r last:border-r-0 border-neutral-100 transition ${
                              isInDropRange
                                ? 'bg-blue-100/70'
                                : d.isToday
                                ? 'bg-blue-50/20'
                                : ''
                            }`}
                          >
                            {/* 드래그 중 실시간 30분 단위 드롭 미리보기 */}
                            {isDropStart && draggingItem && (
                              <div
                                style={{
                                  height: `calc(${previewSlotCount * 100}% + ${(previewSlotCount - 1) * 1}px - 2px)`,
                                  borderColor: previewCat?.color || '#2563eb',
                                  backgroundColor: `${previewCat?.color || '#2563eb'}25`,
                                  zIndex: 30
                                }}
                                className="pointer-events-none absolute inset-x-0.5 top-0.5 rounded-lg border-2 border-dashed px-2 py-1 flex items-center justify-between shadow-sm"
                              >
                                <span className="truncate text-[11px] font-bold text-neutral-900 bg-white/90 px-1.5 py-0.5 rounded shadow-2xs">
                                  {formatHour(slot)} ~ {formatHour(slot + previewDuration)} · {draggingItem.title}
                                </span>
                              </div>
                            )}

                            {startBlock && (
                              <div
                                draggable
                                onDragStart={e => {
                                  startDragWithItem(e, {
                                    todoId: startBlock.todoId,
                                    title: startBlock.title,
                                    categoryId: startBlock.categoryId,
                                    durationHours: startBlock.durationHours,
                                    fromBlockId: startBlock.id
                                  })
                                }}
                                onDragEnd={handleDragEnd}
                                style={{
                                  height: `calc(${slotCount * 100}% + ${(slotCount - 1) * 1}px - 2px)`,
                                  backgroundColor: cat?.color || '#3b82f6',
                                  zIndex: 20
                                }}
                                className={`group absolute inset-x-0.5 top-0.5 rounded-lg p-1 text-white shadow-md transition hover:ring-2 hover:ring-white flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing select-none ${
                                  draggingItem ? 'pointer-events-none' : ''
                                } ${isBeingDragged ? 'opacity-35' : ''}`}
                              >
                                {slotCount <= 1 ? (
                                  <div className="flex h-full items-center justify-between gap-1 text-[10px] leading-tight">
                                    <span className="font-bold truncate" title={startBlock.title}>
                                      {startBlock.title} ({formatHour(startBlock.startHour)}~{formatHour(startBlock.startHour + startBlock.durationHours)})
                                    </span>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                      <button
                                        onClick={e => handleShiftWeeklyBlock(startBlock.id, -0.5, e)}
                                        className="rounded px-1 py-0.2 text-[9px] bg-black/15 hover:bg-black/35 text-white opacity-0 group-hover:opacity-100 transition"
                                        title="30분 앞당기기 (-30분)"
                                      >
                                        -30분
                                      </button>
                                      <button
                                        onClick={e => handleShiftWeeklyBlock(startBlock.id, 0.5, e)}
                                        className="rounded px-1 py-0.2 text-[9px] bg-black/15 hover:bg-black/35 text-white opacity-0 group-hover:opacity-100 transition"
                                        title="30분 뒤로 미루기 (+30분)"
                                      >
                                        +30분
                                      </button>
                                      <button
                                        onClick={e => handleDeleteWeeklyBlock(startBlock.id, e)}
                                        className="rounded p-0.5 text-white/80 hover:bg-black/20 hover:text-white"
                                        title="일정 삭제"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="text-[10px] font-semibold opacity-90 truncate">
                                        {cat?.name} ({startBlock.durationHours}h)
                                      </span>
                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                          onClick={e => handleShiftWeeklyBlock(startBlock.id, -0.5, e)}
                                          className="rounded px-1 py-0.5 text-[9px] font-bold bg-black/15 hover:bg-black/35 text-white opacity-0 group-hover:opacity-100 transition"
                                          title="30분 앞당기기 (-30분)"
                                        >
                                          -30분
                                        </button>
                                        <button
                                          onClick={e => handleShiftWeeklyBlock(startBlock.id, 0.5, e)}
                                          className="rounded px-1 py-0.5 text-[9px] font-bold bg-black/15 hover:bg-black/35 text-white opacity-0 group-hover:opacity-100 transition"
                                          title="30분 뒤로 미루기 (+30분)"
                                        >
                                          +30분
                                        </button>
                                        <button
                                          onClick={e => handleDeleteWeeklyBlock(startBlock.id, e)}
                                          className="rounded p-0.5 text-white/80 hover:bg-black/20 hover:text-white"
                                          title="일정 삭제"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="truncate text-xs font-bold leading-tight my-auto" title={startBlock.title}>
                                      {startBlock.title}
                                    </div>
                                    <div className="text-[9px] opacity-90 font-medium">
                                      {formatHour(startBlock.startHour)} ~ {formatHour(startBlock.startHour + startBlock.durationHours)}
                                    </div>
                                  </>
                                )}
                              </div>
                            )}

                            {/* 빈 슬롯 가이드 */}
                            {!startBlock && !isOccupiedByPrev && !isInDropRange && (
                              <div className="h-full w-full rounded border border-dashed border-transparent hover:border-blue-300 hover:bg-blue-50/20 transition" />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. # 원데이 피드백 (One-Day Feedback) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'daily') && (
        <section className="space-y-6 rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-neutral-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-100 text-sm font-bold text-purple-700">
                  3
                </span>
                <h2 className="text-xl font-bold text-neutral-900">
                  원데이 피드백 (오늘 계획 vs 실제 실행 비교)
                </h2>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                오늘의 위클리 계획(왼쪽)과 실제 실행(오른쪽)을 나란히 비교합니다. 마우스로 긁어서 3-5시 등 실제 한 일을 작성하고, 못한 것은 원클릭으로 [보충시간]에 넣으세요!
              </p>
            </div>

            {/* 날짜 선택기 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const d = new Date(`${feedbackDateStr}T00:00:00`)
                  d.setDate(d.getDate() - 1)
                  const y = d.getFullYear()
                  const m = String(d.getMonth() + 1).padStart(2, '0')
                  const day = String(d.getDate()).padStart(2, '0')
                  setFeedbackDateStr(`${y}-${m}-${day}`)
                }}
                className="rounded-xl border border-neutral-200 p-1.5 hover:bg-neutral-100 transition"
                title="어제"
              >
                <ChevronLeft className="h-4 w-4 text-neutral-700" />
              </button>

              <input
                type="date"
                value={feedbackDateStr}
                onChange={e => setFeedbackDateStr(e.target.value)}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-bold text-neutral-800 focus:outline-none"
              />

              <button
                onClick={() => {
                  const d = new Date(`${feedbackDateStr}T00:00:00`)
                  d.setDate(d.getDate() + 1)
                  const y = d.getFullYear()
                  const m = String(d.getMonth() + 1).padStart(2, '0')
                  const day = String(d.getDate()).padStart(2, '0')
                  setFeedbackDateStr(`${y}-${m}-${day}`)
                }}
                className="rounded-xl border border-neutral-200 p-1.5 hover:bg-neutral-100 transition"
                title="내일"
              >
                <ChevronRight className="h-4 w-4 text-neutral-700" />
              </button>

              <button
                onClick={() => {
                  const today = new Date()
                  const y = today.getFullYear()
                  const m = String(today.getMonth() + 1).padStart(2, '0')
                  const d = String(today.getDate()).padStart(2, '0')
                  setFeedbackDateStr(`${y}-${m}-${d}`)
                }}
                className="rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition"
              >
                오늘로
              </button>
            </div>
          </div>

          {/* 하루 피드백 통계 요약 카드 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
              <span className="text-xs font-semibold text-neutral-500">계획된 시간</span>
              <div className="mt-1 text-2xl font-bold text-neutral-900">
                {dailyStats.plannedHours} <span className="text-sm font-normal text-neutral-500">시간</span>
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
              <span className="text-xs font-semibold text-neutral-500">실제 실행 기록</span>
              <div className="mt-1 text-2xl font-bold text-blue-600">
                {dailyStats.actualHours} <span className="text-sm font-normal text-neutral-500">시간</span>
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
              <span className="text-xs font-semibold text-neutral-500">미완료/보충 필요</span>
              <div className="mt-1 text-2xl font-bold text-purple-600">
                {dailyBlocks.filter(b => b.status === 'failed' || b.status === 'partial').length} <span className="text-sm font-normal text-neutral-500">건</span>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* 오늘 플래너가 세로 한줄로 위에 위클리꺼가 나오고 그 옆에 똑같이 시간플래너가 한줄 있고 */}
          {/* ============================================================== */}
          <div className="rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-neutral-200">
              {/* 왼쪽 열: 위클리 계획 (Plan) */}
              <div className="p-4 bg-neutral-50/40">
                <div className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-neutral-800">
                    <CalendarCheck className="h-4 w-4 text-blue-600" />
                    <span>위클리 계획 (Plan)</span>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {feedbackDateStr} ({['일','월','화','수','목','금','토'][feedbackDateObj.getDay()]}요일)
                  </span>
                </div>

                <div className="space-y-1">
                  {TIME_SLOTS.map(slot => {
                    const isHourStart = slot % 1 === 0
                    const block = feedbackDayWeeklyBlocks.find(
                      b => Math.abs(b.startHour - slot) < 0.01
                    )
                    const isOccupiedByPrev = feedbackDayWeeklyBlocks.some(
                      b => b.startHour < slot && slot < b.startHour + b.durationHours
                    )
                    const cat = block ? categories.find(c => c.id === block.categoryId) : null
                    const slotCount = block ? Math.round(block.durationHours * 2) : 0

                    return (
                      <div
                        key={slot}
                        className={`relative flex h-8 items-center gap-3 rounded-lg border px-2.5 text-xs transition ${
                          isHourStart
                            ? 'border-neutral-200/80 bg-white font-medium'
                            : 'border-dashed border-neutral-100 bg-neutral-50/30'
                        }`}
                      >
                        <span
                          className={`w-12 font-medium select-none ${
                            isHourStart
                              ? 'text-neutral-700 text-[11px] font-bold'
                              : 'text-neutral-400 text-[10px]'
                          }`}
                        >
                          {formatHour(slot)}
                        </span>

                        {block && (
                          <div
                            style={{
                              height: `calc(${slotCount * 100}% + ${(slotCount - 1) * 4}px)`,
                              backgroundColor: cat?.color || '#3b82f6',
                              zIndex: 10
                            }}
                            className="absolute left-16 right-2 top-0.5 rounded-xl p-2 text-white shadow-md flex items-center justify-between"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-bold text-xs truncate">{block.title}</div>
                              <div className="text-[10px] opacity-85 truncate">
                                {cat?.name} ({formatHour(block.startHour)} ~ {formatHour(block.startHour + block.durationHours)})
                              </div>
                            </div>
                            <span className="rounded bg-black/20 px-2 py-0.5 text-[10px] font-semibold flex-shrink-0">
                              {block.durationHours}h
                            </span>
                          </div>
                        )}

                        {!block && !isOccupiedByPrev && isHourStart && (
                          <span className="text-neutral-300 text-[10px] select-none">- 계획 없음 -</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 오른쪽 열: 실제 실행 및 피드백 (Actual Execution) */}
              <div className="p-4 bg-white select-none">
                <div className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-neutral-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>실제 실행 및 피드백 (Actual)</span>
                  </div>
                  <span className="text-xs text-neutral-500">
                    * 시간대를 마우스로 드래그(긁기)하여 입력
                  </span>
                </div>

                <div
                  className="space-y-1"
                  onMouseUp={handleMouseUpFeedback}
                >
                  {TIME_SLOTS.map(slot => {
                    const isHourStart = slot % 1 === 0
                    const block = dailyBlocks.find(b => Math.abs(b.startHour - slot) < 0.01)
                    const isOccupiedByPrev = dailyBlocks.some(
                      b => b.startHour < slot && slot < b.endHour
                    )
                    const cat = block ? categories.find(c => c.id === block.categoryId) : null

                    // 마우스 드래그 선택 중 하이라이트
                    const isSelected =
                      isSelectingTime &&
                      selectionStartHour !== null &&
                      selectionEndHour !== null &&
                      slot >= Math.min(selectionStartHour, selectionEndHour) &&
                      slot < Math.max(selectionStartHour, selectionEndHour)

                    const slotCount = block ? Math.round((block.endHour - block.startHour) * 2) : 0

                    return (
                      <div
                        key={slot}
                        onMouseDown={() => handleMouseDownFeedback(slot)}
                        onMouseEnter={() => handleMouseEnterFeedback(slot)}
                        className={`relative flex h-8 cursor-pointer items-center gap-3 rounded-lg border px-2.5 text-xs transition ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                            : isHourStart
                            ? 'border-neutral-200/80 hover:bg-neutral-50 bg-white'
                            : 'border-dashed border-neutral-100 hover:bg-neutral-50 bg-neutral-50/30'
                        }`}
                      >
                        <span
                          className={`w-12 font-medium select-none ${
                            isHourStart
                              ? 'text-neutral-700 text-[11px] font-bold'
                              : 'text-neutral-400 text-[10px]'
                          }`}
                        >
                          {formatHour(slot)}
                        </span>

                        {block && (
                          <div
                            style={{
                              height: `calc(${slotCount * 100}% + ${(slotCount - 1) * 4}px)`,
                              zIndex: 10
                            }}
                            className={`absolute left-16 right-2 top-0.5 rounded-xl p-2 shadow-md flex items-center justify-between text-white ${
                              isSelectingTime ? 'pointer-events-none' : ''
                            } ${
                              block.status === 'done'
                                ? 'bg-emerald-600'
                                : block.status === 'partial'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            onClick={e => {
                              e.stopPropagation()
                              setEditingFeedbackBlock(block)
                              setFeedbackTitle(block.title)
                              setFeedbackCategory(block.categoryId)
                              setFeedbackStatus(block.status)
                              setFeedbackMemo(block.reflection || '')
                              setSelectionStartHour(block.startHour)
                              setSelectionEndHour(block.endHour)
                              setFeedbackModalOpen(true)
                            }}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="font-bold text-xs truncate flex items-center gap-1.5">
                                <span>{block.title}</span>
                                {block.movedToBuffer && (
                                  <span className="rounded bg-black/30 px-1.5 py-0.2 text-[9px] font-semibold text-purple-200">
                                    보충시간 이동됨
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] opacity-90 truncate">
                                {cat?.name} ({formatHour(block.startHour)} ~ {formatHour(block.endHour)})
                                {block.reflection && ` · ${block.reflection}`}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                              {/* 🌟 원클릭 보충시간으로 넣기 버튼 */}
                              {!block.movedToBuffer && (
                                <button
                                  onClick={() => handleMoveToBufferTask(block)}
                                  className="rounded bg-white/20 hover:bg-white/40 px-2 py-1 text-[10px] font-bold text-white transition flex items-center gap-1"
                                  title="못한 것 보충시간에 넣기"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>보충시간 넣기</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteFeedbackBlock(block.id)}
                                className="rounded p-1 text-white/80 hover:bg-black/20"
                                title="삭제"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}

                        {!block && !isOccupiedByPrev && !isSelected && isHourStart && (
                          <span className="text-neutral-400 text-[10px] select-none">
                            + 클릭 또는 드래그하여 실행 피드백 입력
                          </span>
                        )}

                        {isSelected && (
                          <span className="text-blue-600 font-semibold text-[11px] select-none">
                            선택 중 ({formatHour(Math.min(selectionStartHour || slot, slot))} ~ {formatHour(Math.max(selectionStartHour || slot, slot) + 0.5)})
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 실제 한 일 피드백 작성 모달 */}
      {/* ========================================================================= */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold text-neutral-900">
                  {editingFeedbackBlock ? '실행 피드백 수정' : '실제 한 일 피드백 입력'}
                </h3>
              </div>
              <button
                onClick={() => setFeedbackModalOpen(false)}
                className="rounded-xl p-1 text-neutral-400 hover:bg-neutral-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* 선택된 시간대 표시 */}
              <div className="rounded-2xl bg-neutral-50 p-3 text-xs flex items-center justify-between">
                <span className="font-semibold text-neutral-600">시간대:</span>
                <span className="font-bold text-neutral-900">
                  {formatHour(selectionStartHour || 9)} ~ {formatHour(selectionEndHour || 11)} (
                  {(selectionEndHour || 11) - (selectionStartHour || 9)}시간)
                </span>
              </div>

              {/* 실제 한 일 입력 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  실제 한 일
                </label>
                <input
                  type="text"
                  placeholder="예: 3-5시 집중 업무 진행, 회의 지연으로 일부만 완료 등"
                  value={feedbackTitle}
                  onChange={e => setFeedbackTitle(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3.5 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* 카테고리 선택 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  카테고리
                </label>
                <select
                  value={feedbackCategory}
                  onChange={e => setFeedbackCategory(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:outline-none"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 실행 상태 선택 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  실행 결과 상태
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackStatus('done')}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      feedbackStatus === 'done'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    완료 (성공)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackStatus('partial')}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      feedbackStatus === 'partial'
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    일부 완료
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeedbackStatus('failed')}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      feedbackStatus === 'failed'
                        ? 'bg-red-500 text-white shadow-sm'
                        : 'border border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    미완료 / 못함
                  </button>
                </div>
              </div>

              {/* 피드백 메모 및 사유 */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  피드백 메모 (사유 및 개선점)
                </label>
                <textarea
                  rows={2}
                  placeholder="예: 긴급 전화로 30분 지연됨. 미완료 분량은 보충시간에 진행."
                  value={feedbackMemo}
                  onChange={e => setFeedbackMemo(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 p-2.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
              </div>

              {/* 🌟 핵심 버튼: "못한 것 보충시간에 넣기" */}
              <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-purple-900">
                    못한 것을 보충시간으로 이관할까요?
                  </div>
                  <div className="text-[11px] text-purple-700">
                    투두리스트의 [보충시간] 항목에 자동으로 등록됩니다.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!feedbackTitle.trim()) {
                      alert('먼저 실제 한 일/할일명을 입력해주세요.')
                      return
                    }
                    handleMoveToBufferTask({
                      title: feedbackTitle,
                      categoryId: feedbackCategory
                    })
                  }}
                  className="rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition flex items-center gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>보충시간에 넣기</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
              <button
                type="button"
                onClick={() => setFeedbackModalOpen(false)}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveFeedbackBlock}
                className="rounded-xl bg-neutral-900 px-5 py-2 text-xs font-bold text-white hover:bg-neutral-800 transition shadow-sm"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

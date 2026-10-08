import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { syncNotionDailyLedger } from '@/lib/notion'
import type { Transaction } from '@/lib/firestore'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return handleSync(req)
}

export async function POST(req: NextRequest) {
  return handleSync(req)
}

async function handleSync(req: NextRequest) {
  // Optional Vercel Cron secret verification
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!db) {
    return NextResponse.json({ error: 'Database is not initialized' }, { status: 500 })
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const results: Array<{
    phone: string
    success: boolean
    addedCount: number
    pageTitle?: string
    error?: string
  }> = []

  try {
    // 1. Query all users from userSettings
    const settingsSnap = await getDocs(collection(db, 'userSettings'))
    
    for (const settingsDoc of settingsSnap.docs) {
      const phone = settingsDoc.id
      const settingsData = settingsDoc.data()
      const notionConfig = settingsData?.notionConfig

      if (!notionConfig?.enabled || !notionConfig?.apiKey?.trim() || !notionConfig?.parentPageId?.trim()) {
        continue
      }

      try {
        // 2. Sync from Notion
        const syncRes = await syncNotionDailyLedger({
          apiKey: notionConfig.apiKey.trim(),
          parentPageId: notionConfig.parentPageId.trim(),
          targetDate: todayStr
        })

        if (!syncRes.success) {
          results.push({
            phone,
            success: false,
            addedCount: 0,
            error: syncRes.error || syncRes.message || '가계부 내역 없음'
          })
          continue
        }

        // 3. Load user's existing data and prevent duplicates
        const userDocRef = doc(db, 'userData', phone)
        const userDocSnap = await getDoc(userDocRef)
        const userData = userDocSnap.exists() ? userDocSnap.data() : { transactions: [] }
        const currentTx: Transaction[] = Array.isArray(userData?.transactions) ? userData.transactions : []
        const existingKeys = new Set(currentTx.map((t: any) => `${t.date}|${t.itemName}|${t.amount}`))

        const newTx: Transaction[] = []
        for (const item of syncRes.transactions) {
          const key = `${item.date}|${item.itemName}|${item.amount}`
          if (!existingKeys.has(key)) {
            const uid = Math.random().toString(36).slice(2, 9)
            newTx.push({ ...item, id: uid })
            existingKeys.add(key)
          }
        }

        // 4. Save new transactions to Firestore
        if (newTx.length > 0) {
          await setDoc(userDocRef, {
            ...userData,
            transactions: [...newTx, ...currentTx]
          }, { merge: true })
        }

        // 5. Update lastSyncedAt
        const nowKst = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
        await setDoc(doc(db, 'userSettings', phone), {
          notionConfig: {
            ...notionConfig,
            lastSyncedAt: `${nowKst} (서버 자동)`
          }
        }, { merge: true })

        results.push({
          phone,
          success: true,
          addedCount: newTx.length,
          pageTitle: syncRes.pageTitle
        })
      } catch (userErr: any) {
        console.error(`Error syncing user ${phone}:`, userErr)
        results.push({
          phone,
          success: false,
          addedCount: 0,
          error: userErr.message || '처리 중 오류'
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      date: todayStr,
      processedCount: results.length,
      results
    })
  } catch (err: any) {
    console.error('Nightly cron error:', err)
    return NextResponse.json({ error: err.message || '서버 스케줄러 실행 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

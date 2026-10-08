import { NextRequest, NextResponse } from 'next/server'
import { syncNotionDailyLedger } from '@/lib/notion'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { apiKey, parentPageId, targetDate } = body

    if (!apiKey?.trim()) {
      return NextResponse.json({ error: '노션 API 키가 제공되지 않았습니다.' }, { status: 400 })
    }
    if (!parentPageId?.trim()) {
      return NextResponse.json({ error: '노션 상위 페이지 ID 또는 링크가 제공되지 않았습니다.' }, { status: 400 })
    }

    const result = await syncNotionDailyLedger({
      apiKey: apiKey.trim(),
      parentPageId: parentPageId.trim(),
      targetDate
    })

    if (!result.success) {
      return NextResponse.json({
        error: result.error || result.message || '노션 가계부 내역을 가져오지 못했습니다.',
        ...result
      }, { status: result.error ? 400 : 200 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Notion sync route error:', err)
    return NextResponse.json({ error: err.message || '노션 동기화 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

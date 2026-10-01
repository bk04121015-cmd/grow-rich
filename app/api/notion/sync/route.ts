import { NextRequest, NextResponse } from 'next/server'
import { parseTransactionText, type Transaction } from '@/lib/firestore'

function extractNotionId(input: string): string {
  const cleaned = input.trim()
  const hexMatch = cleaned.match(/([a-f0-9]{32})(?:[/?#]|$)/i) || 
                   cleaned.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
  if (hexMatch) {
    return hexMatch[1].replace(/-/g, '')
  }
  return cleaned.replace(/[^a-zA-Z0-9]/g, '')
}

function getPlainText(richTextArray?: Array<{ plain_text?: string }>): string {
  if (!Array.isArray(richTextArray)) return ''
  return richTextArray.map(t => t.plain_text || '').join('').trim()
}

function extractBlockText(block: any): string {
  const type = block.type
  if (block[type]?.rich_text) {
    return getPlainText(block[type].rich_text)
  }
  if (type === 'child_page') {
    return block.child_page?.title || ''
  }
  return ''
}

function parseDateFromTitle(title: string): string | null {
  const now = new Date()
  const year = now.getFullYear()
  
  // Format: 2026-10-01 or 2026.10.01
  const fullMatch = title.match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/)
  if (fullMatch) {
    return `${fullMatch[1]}-${fullMatch[2].padStart(2, '0')}-${fullMatch[3].padStart(2, '0')}`
  }

  // Format: 9/29(화) or 9/29 or 10.1 or 9월 29일
  const monthDayMatch = title.match(/(\d{1,2})\s*[/.]\s*(\d{1,2})/) || title.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/)
  if (monthDayMatch) {
    const m = monthDayMatch[1].padStart(2, '0')
    const d = monthDayMatch[2].padStart(2, '0')
    return `${year}-${m}-${d}`
  }

  return null
}

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

    const cleanParentId = extractNotionId(parentPageId)
    const notionHeaders = {
      'Authorization': `Bearer ${apiKey.trim()}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    }

    // 1. Try to inspect the provided ID directly
    let targetPageId = cleanParentId
    let pageTitle = '일일저널링'
    let detectedDate = targetDate || new Date().toISOString().slice(0, 10)

    // Check if the provided ID is already a single page
    const directPageRes = await fetch(`https://api.notion.com/v1/pages/${cleanParentId}`, {
      headers: notionHeaders
    })

    let isDirectJournalPage = false

    if (directPageRes.ok) {
      const pageData = await directPageRes.json()
      for (const key of Object.keys(pageData.properties || {})) {
        if (pageData.properties[key]?.type === 'title') {
          const t = getPlainText(pageData.properties[key].title)
          if (t) pageTitle = t
        }
      }
      
      const parsed = parseDateFromTitle(pageTitle)
      if (parsed) {
        detectedDate = parsed
      }

      if (/저널|일일|가계부/.test(pageTitle)) {
        isDirectJournalPage = true
      }
    }

    // 2. If it's a parent container (not directly today's journal), search its child pages
    if (!isDirectJournalPage) {
      let candidatePages: Array<{ id: string; title: string; date: string | null; lastEdited: string }> = []

      // Try 2a: Check if it's a database
      const dbQueryRes = await fetch(`https://api.notion.com/v1/databases/${cleanParentId}/query`, {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({ page_size: 30 })
      })

      if (dbQueryRes.ok) {
        const dbData = await dbQueryRes.json()
        for (const item of dbData.results || []) {
          let title = ''
          for (const key of Object.keys(item.properties || {})) {
            if (item.properties[key]?.type === 'title') {
              title = getPlainText(item.properties[key].title)
            }
          }
          candidatePages.push({
            id: item.id.replace(/-/g, ''),
            title: title || '제목 없음',
            date: parseDateFromTitle(title),
            lastEdited: item.last_edited_time
          })
        }
      } else {
        // Try 2b: Check children blocks of the page
        const childrenRes = await fetch(`https://api.notion.com/v1/blocks/${cleanParentId}/children?page_size=100`, {
          headers: notionHeaders
        })

        if (childrenRes.ok) {
          const childrenData = await childrenRes.json()
          for (const block of childrenData.results || []) {
            if (block.type === 'child_page') {
              const title = block.child_page?.title || ''
              candidatePages.push({
                id: block.id.replace(/-/g, ''),
                title,
                date: parseDateFromTitle(title),
                lastEdited: block.last_edited_time
              })
            }
          }
        }
      }

      // If we found child pages, match with targetDate or pick most recent
      if (candidatePages.length > 0) {
        const todayStr = targetDate || new Date().toISOString().slice(0, 10)
        
        const matchByDate = candidatePages.find(p => p.date === todayStr)
        const [_, curM, curD] = todayStr.split('-')
        const shortDate = `${parseInt(curM, 10)}/${parseInt(curD, 10)}`
        const matchByShort = candidatePages.find(p => p.title.includes(shortDate))

        const selected = matchByDate || matchByShort || candidatePages[0]
        if (selected) {
          targetPageId = selected.id
          pageTitle = selected.title
          detectedDate = selected.date || todayStr
        }
      }
    }

    // 3. Fetch blocks of the target page
    const pageBlocksRes = await fetch(`https://api.notion.com/v1/blocks/${targetPageId}/children?page_size=100`, {
      headers: notionHeaders
    })

    if (!pageBlocksRes.ok) {
      if (pageBlocksRes.status === 401) {
        return NextResponse.json({ error: '노션 API 키가 유효하지 않습니다. 토큰을 확인해 주세요.' }, { status: 401 })
      }
      if (pageBlocksRes.status === 404) {
        return NextResponse.json({ 
          error: '노션 페이지를 찾을 수 없습니다. 노션 페이지 우측 상단 [···] > [연결]에서 생성하신 통합을 추가했는지 확인해 주세요.' 
        }, { status: 404 })
      }
      const errText = await pageBlocksRes.text()
      return NextResponse.json({ error: `노션 API 오류 (${pageBlocksRes.status}): ${errText}` }, { status: 500 })
    }

    const pageBlocks = await pageBlocksRes.json()
    const blocks: any[] = pageBlocks.results || []

    // 4. Locate the '가계부' section
    let ledgerBlockIndex = -1
    let ledgerBlock: any = null

    for (let i = 0; i < blocks.length; i++) {
      const text = extractBlockText(blocks[i])
      if (/가계부/.test(text)) {
        ledgerBlockIndex = i
        ledgerBlock = blocks[i]
        break
      }
    }

    if (ledgerBlockIndex === -1 || !ledgerBlock) {
      return NextResponse.json({
        error: `'${pageTitle}' 페이지에서 '가계부' 항목을 찾지 못했습니다. 페이지에 '8. 가계부' 또는 '가계부' 블록이 있는지 확인해 주세요.`,
        pageTitle
      }, { status: 404 })
    }

    const linesToParse: string[] = []

    // 4a. If the ledger block has children (e.g. Toggle block)
    if (ledgerBlock.has_children) {
      const toggleChildrenRes = await fetch(`https://api.notion.com/v1/blocks/${ledgerBlock.id}/children?page_size=100`, {
        headers: notionHeaders
      })
      if (toggleChildrenRes.ok) {
        const toggleChildrenData = await toggleChildrenRes.json()
        for (const child of toggleChildrenData.results || []) {
          const t = extractBlockText(child)
          if (t) linesToParse.push(...t.split('\n'))
        }
      }
    }

    // 4b. Also scan subsequent sibling blocks until next major heading/number
    for (let i = ledgerBlockIndex + 1; i < blocks.length; i++) {
      const b = blocks[i]
      const text = extractBlockText(b)
      if (!text) continue

      if (/^\s*(?:\d+\.|\#+)/.test(text) || b.type.startsWith('heading_')) {
        break
      }

      linesToParse.push(...text.split('\n'))
    }

    // 5. Parse lines into transactions
    const transactions: Array<Omit<Transaction, 'id'>> = []
    for (const rawLine of linesToParse) {
      const trimmed = rawLine.trim()
      if (!trimmed) continue

      const parsed = parseTransactionText(trimmed, detectedDate)
      if (parsed.amount > 0) {
        transactions.push(parsed)
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json({
        success: false,
        pageTitle,
        detectedDate,
        message: `'${pageTitle}'의 가계부 항목 아래에서 유효한 금액(숫자)이 적힌 내역을 찾지 못했습니다.`,
        rawLines: linesToParse
      })
    }

    return NextResponse.json({
      success: true,
      pageTitle,
      detectedDate,
      count: transactions.length,
      transactions,
      rawLines: linesToParse
    })
  } catch (err: any) {
    console.error('Notion sync route error:', err)
    return NextResponse.json({ error: err.message || '노션 동기화 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

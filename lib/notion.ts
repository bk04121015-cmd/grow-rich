import { parseTransactionText, type Transaction } from '@/lib/firestore'

export function extractNotionId(input: string): string {
  const cleaned = input.trim()
  const hexMatch = cleaned.match(/([a-f0-9]{32})(?:[/?#]|$)/i) || 
                   cleaned.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
  if (hexMatch) {
    return hexMatch[1].replace(/-/g, '')
  }
  const lastHex = cleaned.match(/([a-f0-9]{32})/i)
  if (lastHex) {
    return lastHex[1]
  }
  const alphanumeric = cleaned.replace(/[^a-zA-Z0-9]/g, '')
  if (alphanumeric.length >= 32) {
    return alphanumeric.slice(-32)
  }
  return alphanumeric
}

export function getPlainText(richTextArray?: Array<{ plain_text?: string }>): string {
  if (!Array.isArray(richTextArray)) return ''
  return richTextArray.map(t => t.plain_text || '').join('').trim()
}

export function extractBlockText(block: any): string {
  const type = block.type
  if (block[type]?.rich_text) {
    return getPlainText(block[type].rich_text)
  }
  if (type === 'child_page') {
    return block.child_page?.title || ''
  }
  return ''
}

export async function fetchAllBlockTexts(blockId: string, headers: any, depth = 0): Promise<string[]> {
  if (depth > 3) return []
  const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`, { headers })
  if (!res.ok) return []
  const data = await res.json()
  const lines: string[] = []
  for (const block of data.results || []) {
    const text = extractBlockText(block)
    if (text) lines.push(...text.split('\n'))
    if (block.has_children && block.type !== 'child_page') {
      const nested = await fetchAllBlockTexts(block.id, headers, depth + 1)
      lines.push(...nested)
    }
  }
  return lines
}

export function parseDateFromTitle(title: string): string | null {
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

export type NotionSyncResult = {
  success: boolean
  pageTitle: string
  detectedDate: string
  count: number
  transactions: Array<Omit<Transaction, 'id'>>
  rawLines: string[]
  error?: string
  message?: string
}

export async function syncNotionDailyLedger({
  apiKey,
  parentPageId,
  targetDate
}: {
  apiKey: string
  parentPageId: string
  targetDate?: string
}): Promise<NotionSyncResult> {
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

  // 2. If it's a parent container, search its child pages
  if (!isDirectJournalPage) {
    let candidatePages: Array<{ id: string; title: string; date: string | null; lastEdited: string }> = []

    // 2a: Check if it's a database
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
      // 2b: Check children blocks of the page
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

    // 2c: Fallback to Notion Search API
    if (candidatePages.length === 0) {
      const searchRes = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          filter: { value: 'page', property: 'object' },
          sort: { direction: 'descending', timestamp: 'last_edited_time' },
          page_size: 20
        })
      })

      if (searchRes.ok) {
        const searchData = await searchRes.json()
        for (const item of searchData.results || []) {
          let title = ''
          for (const key of Object.keys(item.properties || {})) {
            if (item.properties[key]?.type === 'title') {
              title = getPlainText(item.properties[key].title)
            }
          }
          if (/저널|일일|가계부/.test(title) || parseDateFromTitle(title)) {
            candidatePages.push({
              id: item.id.replace(/-/g, ''),
              title: title || '제목 없음',
              date: parseDateFromTitle(title),
              lastEdited: item.last_edited_time
            })
          }
        }
      }
    }

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
      return { success: false, pageTitle, detectedDate, count: 0, transactions: [], rawLines: [], error: '노션 API 키가 유효하지 않습니다. 토큰을 확인해 주세요.' }
    }
    if (pageBlocksRes.status === 404) {
      return { 
        success: false, pageTitle, detectedDate, count: 0, transactions: [], rawLines: [],
        error: '노션 페이지를 찾을 수 없습니다. 노션 페이지 우측 상단 [···] > [연결]에서 생성하신 통합을 추가했는지 확인해 주세요.' 
      }
    }
    const errText = await pageBlocksRes.text()
    return { success: false, pageTitle, detectedDate, count: 0, transactions: [], rawLines: [], error: `노션 API 오류 (${pageBlocksRes.status}): ${errText}` }
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
    return {
      success: false,
      pageTitle,
      detectedDate,
      count: 0,
      transactions: [],
      rawLines: [],
      error: `'${pageTitle}' 페이지에서 '가계부' 항목을 찾지 못했습니다. 페이지에 '8. 가계부' 또는 '가계부' 블록이 있는지 확인해 주세요.`
    }
  }

  const linesToParse: string[] = []

  // 4a. If the ledger block has children (e.g. Toggle block)
  if (ledgerBlock.has_children) {
    const toggleLines = await fetchAllBlockTexts(ledgerBlock.id, notionHeaders)
    linesToParse.push(...toggleLines)
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
    return {
      success: false,
      pageTitle,
      detectedDate,
      count: 0,
      transactions: [],
      rawLines: linesToParse,
      message: `'${pageTitle}'의 가계부 항목 아래에서 유효한 금액(숫자)이 적힌 내역을 찾지 못했습니다.`
    }
  }

  return {
    success: true,
    pageTitle,
    detectedDate,
    count: transactions.length,
    transactions,
    rawLines: linesToParse
  }
}

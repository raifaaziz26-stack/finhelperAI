import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { guessCategory } from './bankParser'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// ─── amount & date helpers ────────────────────────────────────────────────────

// BCA / US format: 31,000.00
function parseAmtUs(val) {
  if (!val && val !== 0) return 0
  return parseFloat(String(val).trim().replace(/[()]/g, '').replace(/,/g, '')) || 0
}

// Indonesian format: 5.000.000,00  (also strips leading +/-)
function parseAmtId(val) {
  if (!val && val !== 0) return 0
  const s = String(val).trim().replace(/^[+\-]\s*/, '').replace(/[()]/g, '')
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
}

// Like parseAmtId but preserves the sign — used for BNI signed Nominal column
function parseAmtSigned(val) {
  if (!val && val !== 0) return 0
  const s = String(val).trim()
  const isNeg = s.startsWith('-')
  const cleaned = s.replace(/^[+\-]\s*/, '').replace(/[()]/g, '')
  const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0
  return isNeg ? -n : n
}

// DD/MM/YYYY
function parseDtSlash(val) {
  const m = String(val).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// DD Mon YYYY  (Indonesian: "02 Jun 2025")
const ID_MONTHS = {
  jan:'01', feb:'02', mar:'03', apr:'04', mei:'05', jun:'06',
  jul:'07', agu:'08', sep:'09', okt:'10', nov:'11', des:'12',
  may:'05', aug:'08', oct:'10', dec:'12',
}
function parseDtIdLong(val) {
  const m = String(val).trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (!m) return null
  const mon = ID_MONTHS[m[2].toLowerCase().slice(0, 3)]
  return mon ? `${m[3]}-${mon}-${m[1].padStart(2, '0')}` : null
}

// ─── PDF text extraction ──────────────────────────────────────────────────────

async function extractLines(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const allItems = []
  let yOffset = 0

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    for (const item of content.items) {
      const text = (item.str || '').trim()
      if (!text) continue
      allItems.push({
        text,
        x: Math.round(item.transform[4]),
        y: Math.round(yOffset + vp.height - item.transform[5]),
        page: p,
      })
    }
    yOffset += vp.height + 30
  }

  const sorted = [...allItems].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines = []
  let group = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - group[0].y) <= 4) {
      group.push(sorted[i])
    } else {
      lines.push({ y: group[0].y, items: group.sort((a, b) => a.x - b.x) })
      group = [sorted[i]]
    }
  }
  if (group.length) lines.push({ y: group[0].y, items: group.sort((a, b) => a.x - b.x) })

  return lines
}

// ─── BCA parser ───────────────────────────────────────────────────────────────
// Table header: TANGGAL | KETERANGAN | MUTASI
// Date:   "PEND" (pending) or "DD/MM/YYYY"
// Amount: "31,000.00 DB" or "150,000.00 CR" — may be one PDF item or two adjacent items

function cleanBcaDesc(raw) {
  let d = raw
  const afterAmount = d.match(/\d+\.00(.+)$/)
  if (afterAmount) {
    d = afterAmount[1].trim()
  } else {
    d = d.replace(/^\d{4}\/[A-Z0-9]+\/[A-Z0-9]+\//gi, '').trim()
    d = d.replace(/^TGL:\s*\d{4}\s*/i, '').trim()
    d = d.replace(/^QR\s+\d+\s*/i, '').trim()
    d = d.replace(/(\s*-+\s*)+$/, '').trim()
  }
  return d.replace(/\s+/g, ' ').trim() || raw.trim()
}

function parseBca(lines) {
  // Step 1: locate the transaction table header to get real column X positions
  const headerIdx = lines.findIndex(l => {
    const text = l.items.map(i => i.text).join(' ').toUpperCase()
    return text.includes('TANGGAL') && text.includes('KETERANGAN') && text.includes('MUTASI')
  })

  // Step 2: extract column X positions from the header
  let dateX, keteranganX, mutasiX
  if (headerIdx >= 0) {
    for (const it of lines[headerIdx].items) {
      const t = it.text.toUpperCase()
      if (t === 'TANGGAL' && dateX === undefined) dateX = it.x
      else if (/KETERANGAN|URAIAN/.test(t) && keteranganX === undefined) keteranganX = it.x
      else if (t === 'MUTASI' && mutasiX === undefined) mutasiX = it.x
    }
  }

  // Amount can appear as one item "31,000.00 DB" or two adjacent items "31,000.00" + "DB"/"CR"
  const COMBINED_RE = /([\d,]+\.\d{2})\s*(DB|CR)/i
  const AMOUNT_ONLY_RE = /^[\d,]+\.\d{2}$/
  const DATE_FULL_RE = /^\d{2}\/\d{2}\/\d{4}$/
  const COL_TOL = 80

  const transactions = []
  let lastDate = null
  let currentTx = null

  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0

  for (const line of lines.slice(startIdx)) {
    // Skip page header/footer repetitions
    if (line.items.map(i => i.text).join(' ').toUpperCase().includes('TANGGAL') &&
        line.items.map(i => i.text).join(' ').toUpperCase().includes('MUTASI')) continue

    // ── Find MUTASI (amount+type) in this line ──
    // Try combined item first: "31,000.00 DB"
    let mutasiItem = line.items.find(it =>
      COMBINED_RE.test(it.text) &&
      (mutasiX === undefined || Math.abs(it.x - mutasiX) < COL_TOL * 2)
    )

    // Then try separate items: amount item + DB/CR item to its right
    let amtItem = null, dbcrItem = null
    if (!mutasiItem) {
      amtItem = line.items.find(it =>
        AMOUNT_ONLY_RE.test(it.text.trim()) &&
        (mutasiX === undefined || it.x >= mutasiX - COL_TOL)
      )
      if (amtItem) {
        dbcrItem = line.items.find(it =>
          /^(DB|CR)$/i.test(it.text.trim()) && it.x > amtItem.x
        )
      }
    }

    const hasAmount = mutasiItem || (amtItem && dbcrItem)
    if (hasAmount) {
      if (currentTx) transactions.push(currentTx)

      // ── Parse date ──
      const dateItem = line.items.find(it =>
        (DATE_FULL_RE.test(it.text) || it.text.toUpperCase() === 'PEND') &&
        (dateX === undefined || Math.abs(it.x - dateX) < COL_TOL)
      )
      let date
      if (!dateItem || dateItem.text.toUpperCase() === 'PEND') {
        date = lastDate || new Date().toISOString().split('T')[0]
      } else {
        date = parseDtSlash(dateItem.text)
        lastDate = date
      }

      // ── Parse amount + type ──
      let amount, type
      if (mutasiItem) {
        const m = mutasiItem.text.match(COMBINED_RE)
        amount = parseAmtUs(m[1])
        type = m[2].toUpperCase() === 'CR' ? 'income' : 'expense'
      } else {
        amount = parseAmtUs(amtItem.text)
        type = dbcrItem.text.toUpperCase() === 'CR' ? 'income' : 'expense'
      }
      if (!amount || amount <= 0) continue

      // ── Parse description: items between keterangan and mutasi columns ──
      const mutasiItemX = (mutasiItem || amtItem).x
      const descItems = line.items.filter(it => {
        if (it === dateItem || it === mutasiItem || it === amtItem || it === dbcrItem) return false
        if (keteranganX !== undefined && it.x < keteranganX - COL_TOL) return false
        if (it.x >= mutasiItemX - 10) return false
        return true
      })
      const description = cleanBcaDesc(descItems.map(i => i.text).join(' '))

      currentTx = { date, description, amount, type }
    } else if (currentTx) {
      // ── Continuation row: no amount, add text to description ──
      const descItems = line.items.filter(it => {
        if (keteranganX !== undefined && it.x < keteranganX - COL_TOL) return false
        if (mutasiX !== undefined && it.x >= mutasiX - COL_TOL) return false
        return true
      })
      const moreText = descItems.map(it => it.text).join(' ').trim()
      if (moreText && !/^(TANGGAL|HALAMAN|PAGE)\b/i.test(moreText)) {
        currentTx.description += ' ' + moreText
      }
    }
  }

  if (currentTx) transactions.push(currentTx)

  // If the header-based approach found nothing, fall back to hardcoded coordinate approach
  if (transactions.length === 0) {
    return parseBcaLegacy(lines)
  }

  return transactions
    .filter(t => t.amount > 0)
    .map(t => ({ ...t, category: guessCategory(t.description, t.type) }))
}

// Fallback for BCA PDFs where the header cannot be found by keyword
function parseBcaLegacy(lines) {
  const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/
  const transactions = []
  let lastDate = null

  for (const line of lines) {
    const first = line.items[0]
    if (!first || first.x < 140 || first.x > 220) continue

    let date
    if (DATE_RE.test(first.text)) {
      date = parseDtSlash(first.text)
      lastDate = date
    } else if (first.text === 'PEND') {
      date = lastDate || new Date().toISOString().split('T')[0]
    } else continue

    const dbcrItem = line.items.find(it => it.x >= 1900 && /^(DB|CR)$/i.test(it.text))
    if (!dbcrItem) continue
    const type = dbcrItem.text.toUpperCase() === 'CR' ? 'income' : 'expense'

    const amtItem = line.items.find(it => it.x >= 1700 && it.x < 1900 && /[\d,]+\.\d{2}/.test(it.text))
    if (!amtItem) continue
    const amount = parseAmtUs(amtItem.text)
    if (!amount || amount <= 0) continue

    const descParts = line.items.filter(it => it.x >= 400 && it.x < 1700).map(it => it.text)
    const description = cleanBcaDesc(descParts.join(' '))

    transactions.push({ date, description, amount, type, category: guessCategory(description, type) })
  }

  return transactions
}

// ─── Mandiri parser ────────────────────────────────────────────────────────────
// Table: Tanggal Trx | Tanggal Val | Rincian Transaksi | Debit/Kredit | Saldo
// Date:  "01/06" (DD/MM short) — year comes from the Periode header line
// Amount: "3,500.00 D" (D=expense) or "500,000.00" / "500,000.00 K" (income)
// Multi-line descriptions: continuation rows have no date and no amount

function extractPeriodYear(fullText) {
  // "Periode: 1/06/23 s/d ..." or "Periode: 01/06/2023 ..."
  const m = fullText.match(/periode\s*[:\s]+\d{1,2}\/\d{1,2}\/(\d{2,4})/i)
  if (m) {
    const yr = m[1]
    return yr.length === 2 ? 2000 + parseInt(yr) : parseInt(yr)
  }
  return new Date().getFullYear()
}

function parseMandiri(lines, periodYear) {
  // Find the transaction table header
  const headerIdx = lines.findIndex(l => {
    const text = l.items.map(i => i.text).join(' ')
    return /tanggal/i.test(text) && (/rincian/i.test(text) || /debit.*kredit/i.test(text))
  })
  if (headerIdx === -1) return []

  // Detect column X positions from the header row
  const header = lines[headerIdx]
  let dateX, rincianX, amountX, saldoX
  const COL_TOL = 50

  for (const it of header.items) {
    const t = it.text.toLowerCase()
    if (/^tanggal/.test(t) && dateX === undefined) dateX = it.x
    else if (/rincian|keterangan|deskripsi/.test(t) && rincianX === undefined) rincianX = it.x
    else if (/debit|kredit|d\/k|mutasi/.test(t) && amountX === undefined) amountX = it.x
    else if (/saldo/.test(t) && saldoX === undefined) saldoX = it.x
  }

  // Amount patterns: "3,500.00 D" or "500,000.00 K" or "500,000.00" (income, no suffix)
  // Combined in one PDF text item, or amount and "D"/"K" as separate items
  const COMBINED_RE = /([\d,.]+(?:\.\d{2})?)\s*([DK])$/i
  const AMOUNT_ONLY_RE = /^[\d,.]+(?:\.\d{2})?$/
  // Mandiri date column: "01/06" (DD/MM without year)
  const DATE_DDMM_RE = /^(\d{1,2})\/(\d{2})$/

  const transactions = []
  let currentTx = null

  for (const line of lines.slice(headerIdx + 1)) {
    const lineText = line.items.map(i => i.text).join(' ')

    // Skip repeated headers, footers, and "Saldo Awal" summary lines
    if (/tanggal.*rincian|saldo awal|halaman\s+\d/i.test(lineText)) continue

    // ── Find date item: "01/06" at approximately dateX ──
    const dateItem = line.items.find(it =>
      DATE_DDMM_RE.test(it.text.trim()) &&
      (dateX === undefined || Math.abs(it.x - dateX) < COL_TOL * 2)
    )

    // ── Find amount+type at approximately amountX ──
    // Try combined item: "3,500.00 D"
    let amountItem = line.items.find(it =>
      COMBINED_RE.test(it.text.trim()) &&
      (amountX === undefined || Math.abs(it.x - amountX) < COL_TOL * 3)
    )
    // Try separate items: "3,500.00" + "D"/"K" nearby
    let typeItem = null
    if (!amountItem) {
      const candidateAmt = line.items.find(it =>
        AMOUNT_ONLY_RE.test(it.text.trim()) && parseAmtUs(it.text) > 0 &&
        (amountX === undefined || Math.abs(it.x - amountX) < COL_TOL * 3)
      )
      if (candidateAmt) {
        typeItem = line.items.find(it =>
          /^[DK]$/i.test(it.text.trim()) &&
          it.x > candidateAmt.x && it.x < candidateAmt.x + 80
        )
        if (typeItem) amountItem = candidateAmt
      }
    }

    const hasAmount = amountItem !== undefined

    if (dateItem && hasAmount) {
      // ── Main transaction row ──
      if (currentTx) transactions.push(currentTx)

      const dm = dateItem.text.trim().match(DATE_DDMM_RE)
      const date = `${periodYear}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`

      let amount, type
      if (typeItem) {
        // Separate format
        amount = parseAmtUs(amountItem.text)
        type = typeItem.text.toUpperCase() === 'D' ? 'expense' : 'income'
      } else {
        // Combined format: "3,500.00 D"
        const m = amountItem.text.trim().match(COMBINED_RE)
        amount = parseAmtUs(m[1])
        // D = Debit (expense), K = Kredit (income), no suffix = income (kredit)
        type = m[2] && m[2].toUpperCase() === 'D' ? 'expense' : 'income'
      }
      if (!amount || amount <= 0) continue

      // Description: items between rincianX and amountX
      const amtItemX = amountItem.x
      const descItems = line.items.filter(it => {
        if (it === dateItem || it === amountItem || it === typeItem) return false
        if (rincianX !== undefined && it.x < rincianX - COL_TOL) return false
        if (it.x >= amtItemX - 5) return false
        return true
      })

      currentTx = {
        date,
        description: descItems.map(i => i.text).join(' ').trim(),
        amount,
        type,
      }
    } else if (currentTx && !dateItem) {
      // ── Continuation row: more description text ──
      const contItems = line.items.filter(it => {
        if (rincianX !== undefined && it.x < rincianX - COL_TOL) return false
        if (saldoX !== undefined && it.x >= saldoX - COL_TOL) return false
        if (amountX !== undefined && it.x >= amountX - COL_TOL) return false
        return true
      })
      const moreText = contItems.map(i => i.text).join(' ').trim()
      if (moreText) currentTx.description += ' ' + moreText
    }
  }

  if (currentTx) transactions.push(currentTx)

  return transactions
    .filter(t => t.amount > 0)
    .map(t => ({ ...t, description: t.description.trim(), category: guessCategory(t.description, t.type) }))
}

// ─── BNI parser ───────────────────────────────────────────────────────────────
// Table: Tanggal | Nominal | Keterangan | Saldo
// Amount: signed Nominal (+5,000,000 = income, -500,000 = expense)
// parseGeneric cannot handle this because it infers type from description keywords,
// not from the sign of the Nominal value.

function parseBni(lines) {
  const headerIdx = lines.findIndex(l => {
    const text = l.items.map(i => i.text).join(' ')
    return /nominal/i.test(text) && /tanggal/i.test(text)
  })
  if (headerIdx === -1) return parseGeneric(lines)

  const header = lines[headerIdx]
  let dateX, nominalX, keteranganX, saldoX
  const COL_TOL = 50

  for (const it of header.items) {
    const t = it.text.toLowerCase()
    if (/^tanggal/.test(t) && dateX === undefined) dateX = it.x
    else if (/^nominal/.test(t) && nominalX === undefined) nominalX = it.x
    else if (/keterangan|deskripsi/.test(t) && keteranganX === undefined) keteranganX = it.x
    else if (/saldo/.test(t) && saldoX === undefined) saldoX = it.x
  }

  const DATE_RE = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/
  const transactions = []
  let currentTx = null

  for (const line of lines.slice(headerIdx + 1)) {
    const dateItem = line.items.find(it =>
      DATE_RE.test(it.text) &&
      (dateX === undefined || Math.abs(it.x - dateX) < COL_TOL)
    )

    if (!dateItem) {
      // Continuation row
      if (currentTx) {
        const moreItems = line.items.filter(it =>
          (keteranganX === undefined || it.x >= keteranganX - COL_TOL) &&
          (saldoX === undefined || it.x < saldoX - COL_TOL) &&
          (nominalX === undefined || it.x < nominalX - COL_TOL)
        )
        const moreText = moreItems.map(i => i.text).join(' ').trim()
        if (moreText) currentTx.description += ' ' + moreText
      }
      continue
    }

    if (currentTx) transactions.push(currentTx)

    const date = parseDtSlash(dateItem.text) || dateItem.text

    // Nominal: signed value (+5000000 income, -500000 expense)
    const nomItem = line.items.find(it =>
      nominalX !== undefined
        ? Math.abs(it.x - nominalX) < COL_TOL * 2
        : /^[+\-]?[\d.,]+$/.test(it.text.trim())
    )
    if (!nomItem) continue

    const nominal = parseAmtSigned(nomItem.text)
    const amount = Math.abs(nominal)
    if (!amount || amount <= 0) continue
    const type = nominal >= 0 ? 'income' : 'expense'

    // Description
    const descItems = line.items.filter(it => {
      if (it === dateItem || it === nomItem) return false
      if (keteranganX !== undefined && it.x < keteranganX - COL_TOL) return false
      if (saldoX !== undefined && it.x >= saldoX - COL_TOL) return false
      if (nominalX !== undefined && Math.abs(it.x - nominalX) < COL_TOL) return false
      return true
    })
    const description = descItems.map(i => i.text).join(' ').trim()

    currentTx = { date, description, amount, type }
  }

  if (currentTx) transactions.push(currentTx)

  return transactions
    .filter(t => t.amount > 0)
    .map(t => ({ ...t, category: guessCategory(t.description, t.type) }))
}

// ─── Timestamp-column parser (KOPNUS, BPR, Koperasi) ─────────────────────────

function cleanTimestampDesc(raw) {
  let d = raw
  d = d.replace(/\bDARI\s+\d{6,}\s*/gi, '').trim()
  d = d.replace(/\s+KE\s+REK-\s*$/i, '').trim()
  d = d.replace(/\s+KE\s*$/i, '').trim()
  d = d.replace(/\b\d{10,}\b/g, '').trim()
  return d.replace(/\s+/g, ' ').trim() || raw.trim()
}

function parseTimestamp(lines) {
  const headerIdx = lines.findIndex(l =>
    /BULAN/i.test(l.items.map(i => i.text).join(' ')) &&
    /TIMESTAMP/i.test(l.items.map(i => i.text).join(' '))
  )
  if (headerIdx === -1) return []

  const header = lines[headerIdx]
  let timestampX = 102, keteranganX = 172, saldoX = 518
  for (const it of header.items) {
    const t = it.text.toUpperCase()
    if (t === 'TIMESTAMP') timestampX = it.x
    else if (t === 'KETERANGAN') keteranganX = it.x
    else if (t === 'SALDO') saldoX = it.x
  }

  const COL_TOL = 35
  const transactions = []

  for (const line of lines.slice(headerIdx + 1)) {
    const dateItem = line.items.find(it =>
      Math.abs(it.x - timestampX) < COL_TOL &&
      /^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(it.text.trim())
    )
    if (!dateItem) continue

    const date = parseDtIdLong(dateItem.text)
    if (!date) continue

    const mutasiItem = line.items.find(it =>
      it.x < saldoX - COL_TOL &&
      /^[+\-]\s*[\d.,]+/.test(it.text.trim())
    )
    if (!mutasiItem) continue

    const amount = parseAmtId(mutasiItem.text)
    if (!amount || amount <= 0) continue
    const type = mutasiItem.text.trim().startsWith('+') ? 'income' : 'expense'

    const mutasiX = mutasiItem.x
    const descParts = line.items
      .filter(it => it.x >= keteranganX - COL_TOL && it.x < mutasiX - 10)
      .map(it => it.text)
    const description = cleanTimestampDesc(descParts.join(' '))

    transactions.push({ date, description, amount, type, category: guessCategory(description, type) })
  }

  return transactions
}

// ─── Generic parser (fallback for BRI and unknown formats) ───────────────────
// Handles: separate Debit/Kredit columns (BRI), or single amount column

function parseGeneric(lines) {
  const HEADER_RE = /tanggal|date|keterangan|deskripsi|debit|kredit|jumlah|nominal/i
  const headerIdx = lines.findIndex(l => {
    const hits = (l.items.map(i => i.text).join(' ').match(new RegExp(HEADER_RE.source, 'gi')) || []).length
    return hits >= 2
  })

  const AMT_RE = /\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{0,2})?\b/g
  const DATE_START = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/

  if (headerIdx !== -1) {
    const headerItems = lines[headerIdx].items
    const cols = {}
    for (const it of headerItems) {
      const t = it.text.toLowerCase()
      if (/tanggal|date/.test(t)) cols.date = it.x
      else if (/keterangan|deskripsi|desc/.test(t)) cols.desc = it.x
      else if (/^debit$|^db$/.test(t)) cols.debit = it.x
      else if (/^kredit$|^cr$|^credit$/.test(t)) cols.credit = it.x
      else if (/jumlah|nominal|amount/.test(t)) cols.amount = it.x
      else if (/saldo|balance/.test(t)) cols.saldo = it.x
    }

    const hasDebitCredit = cols.debit !== undefined && cols.credit !== undefined
    const COL_TOL = 50
    const transactions = []
    let currentTx = null

    for (const line of lines.slice(headerIdx + 1)) {
      const first = line.items[0]
      if (!first) continue

      if (DATE_START.test(first.text)) {
        if (currentTx) transactions.push(currentTx)

        const date = parseDtSlash(first.text) || first.text
        let debit = 0, credit = 0, single = 0, desc = ''

        for (const it of line.items.slice(1)) {
          if (cols.saldo !== undefined && it.x >= cols.saldo - COL_TOL) continue
          if (hasDebitCredit) {
            if (cols.debit !== undefined && Math.abs(it.x - cols.debit) < COL_TOL) debit = parseAmtUs(it.text)
            else if (cols.credit !== undefined && Math.abs(it.x - cols.credit) < COL_TOL) credit = parseAmtUs(it.text)
            else desc += it.text + ' '
          } else {
            if (cols.amount !== undefined && it.x >= cols.amount - COL_TOL) single = parseAmtUs(it.text)
            else desc += it.text + ' '
          }
        }

        desc = desc.replace(/\s+/g, ' ').trim()
        let amount, type
        if (hasDebitCredit) {
          if (credit > 0) { amount = credit; type = 'income' }
          else if (debit > 0) { amount = debit; type = 'expense' }
          else { currentTx = null; continue }
        } else {
          amount = single
          type = /\b(CR|K|KREDIT)\b/i.test(desc) ? 'income' : 'expense'
          desc = desc.replace(/\b(CR|DB|K|D|KREDIT|DEBIT)\b/gi, '').trim()
        }

        if (!amount || amount <= 0) { currentTx = null; continue }
        currentTx = { date, description: desc, amount, type }
      } else if (currentTx) {
        // Continuation row
        const moreItems = line.items.filter(it =>
          (cols.desc === undefined || it.x >= cols.desc - COL_TOL) &&
          (cols.saldo === undefined || it.x < cols.saldo - COL_TOL)
        )
        const moreText = moreItems.map(i => i.text).join(' ').trim()
        if (moreText) currentTx.description += ' ' + moreText
      }
    }
    if (currentTx) transactions.push(currentTx)

    if (transactions.length > 0) {
      return transactions
        .filter(t => t.amount > 0)
        .map(t => ({ ...t, category: guessCategory(t.description, t.type) }))
    }
  }

  // Last resort: scan every line for date + amount pattern
  const transactions = []
  for (const line of lines) {
    const text = line.items.map(i => i.text).join(' ')
    if (!DATE_START.test(text)) continue
    const dateM = text.match(DATE_START)
    const amounts = []
    let m
    while ((m = AMT_RE.exec(text)) !== null) amounts.push({ val: parseAmtUs(m[0]), idx: m.index })
    if (!amounts.length) continue
    const amount = amounts.length >= 2 ? amounts[amounts.length - 2].val : amounts[0].val
    if (!amount || amount <= 0) continue
    const rest = text.slice(dateM[0].length, amounts[0].idx)
    const type = /\b(CR|K|KREDIT)\b/i.test(rest) ? 'income' : 'expense'
    const desc = rest.replace(/\b(CR|DB|K|D|KREDIT|DEBIT)\b/gi, '').replace(/\s+/g, ' ').trim()
    transactions.push({ date: parseDtSlash(dateM[0]) || dateM[0], description: desc, amount, type, category: guessCategory(desc, type) })
  }
  return transactions
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function parsePdfFile(file) {
  const lines = await extractLines(file)
  if (lines.length === 0) {
    throw new Error('PDF tidak mengandung teks. PDF scan/foto tidak didukung — gunakan PDF dari internet banking (teks asli).')
  }

  const fullText = lines.map(l => l.items.map(i => i.text).join(' ')).join('\n')

  // Use the first ~3000 chars (header area) for bank name detection to avoid matching
  // other bank names that appear inside transaction descriptions
  const headerText = fullText.slice(0, 3000)

  const isMandiri = /BANK\s*MANDIRI|MANDIRI\s+TABUNGAN|MANDIRI\s+GIRO/i.test(headerText) ||
    (/MANDIRI/i.test(headerText) && /Tanggal\s+Trx|Rincian\s+Transaksi/i.test(fullText))

  const isBri = !isMandiri && (
    /BANK\s*RAKYAT\s*INDONESIA|\bBRI\b/i.test(headerText) &&
    !/BCA|BNI|MANDIRI/i.test(headerText)
  )

  const isBni = !isMandiri && !isBri && (
    /BANK\s*NEGARA\s*INDONESIA|\bBNI\b/i.test(headerText) &&
    !/BCA|BRI|MANDIRI/i.test(headerText)
  )

  const hasBulanTimestamp = /BULAN/i.test(fullText) && /TIMESTAMP/i.test(fullText)

  const isBca = !isMandiri && !isBri && !isBni && !hasBulanTimestamp && (
    /MUTASI REKENING|BANK\s*CENTRAL\s*ASIA|\bBCA\b/i.test(headerText) ||
    /\b(DB|CR)\b/.test(fullText)
  )

  let transactions, bankName, source

  if (isMandiri) {
    const year = extractPeriodYear(fullText)
    transactions = parseMandiri(lines, year)
    // If Mandiri-specific parser found nothing, fall back to generic
    if (transactions.length === 0) transactions = parseGeneric(lines)
    bankName = 'Mandiri'
    source = 'mandiri'
  } else if (isBca) {
    transactions = parseBca(lines)
    bankName = 'BCA'
    source = 'bca'
  } else if (hasBulanTimestamp) {
    transactions = parseTimestamp(lines)
    const kopnusMatch = fullText.match(/KOPNUS|BPR\s+\w+|KOPERASI\s+\w+/i)
    bankName = kopnusMatch ? kopnusMatch[0].replace(/\s+/g, ' ').trim() : 'Koperasi/BPR'
    source = 'pdf'
  } else if (isBri) {
    // BRI PDF has Debit/Kredit columns — parseGeneric handles these correctly
    transactions = parseGeneric(lines)
    bankName = 'BRI'
    source = 'bri'
  } else if (isBni) {
    transactions = parseBni(lines)
    if (transactions.length === 0) transactions = parseGeneric(lines)
    bankName = 'BNI'
    source = 'bni'
  } else {
    transactions = parseGeneric(lines)
    bankName = 'PDF (Otomatis)'
    source = 'pdf'
  }

  if (transactions.length === 0) {
    throw new Error('Tidak ada transaksi yang ditemukan dalam PDF. Pastikan PDF berisi tabel mutasi rekening dengan kolom tanggal dan jumlah.')
  }

  return { transactions, bank: bankName, source }
}

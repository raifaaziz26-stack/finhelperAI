import * as XLSX from 'xlsx'

const MAX_FILE_BYTES = 5 * 1024 * 1024  // 5 MB
const MAX_ROWS = 1000

// ─── amount helpers ───────────────────────────────────────────────────────────

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0
  const s = String(val).trim()
  const isNegative = s.startsWith('(') && s.endsWith(')')
  const cleaned = s.replace(/[()]/g, '').trim()
  let normalized
  // Indonesian format: 1.000.000,00
  if (cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    normalized = cleaned.replace(/,/g, '')
  }
  const num = parseFloat(normalized) || 0
  return isNegative ? -num : num
}

function parseDate(val) {
  if (!val) return new Date().toISOString().split('T')[0]
  if (val instanceof Date) return val.toISOString().split('T')[0]
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // DD/MM/YY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/)
  if (dmy) {
    const [, d, m, y] = dmy
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return new Date().toISOString().split('T')[0]
}

// ─── category detection ───────────────────────────────────────────────────────

export function guessCategory(description, type) {
  const d = (description || '').toLowerCase()
  if (type === 'income') {
    if (/gaji|salary|thr|setoran gaji|bonus/.test(d)) return 'salary'
    if (/freelance|proyek|jasa/.test(d)) return 'freelance'
    if (/investasi|dividen|bunga|saham/.test(d)) return 'investment'
    if (/hadiah|gift/.test(d)) return 'gift'
    return 'other_income'
  }
  // Transfer must be checked before food/shopping — many descriptions contain "ke"
  if (/\btransfer\b|bilyet|kliring|trf\b|overbooking|pindah buku/.test(d)) return 'transfer'
  if (/\btarik\b|penarikan|atm|cash withdrawal|csh wdl/.test(d)) return 'cash'
  if (/\badmin\b|biaya adm|biaya transfer|biaya bulanan|pajak|bea|materai/.test(d)) return 'fee'
  if (/makan|food|resto|kfc|mcd|pizza|burger|cafe|coffee|starbucks|warung|sate|ayam|bebek|gofood|grabfood|shopeefood/.test(d)) return 'food'
  if (/grab|gojek|ojek|taxi|bensin|bbm|spbu|shell|pertamina|toll|tol|parkir|bus|kereta|commuter|mrt|lrt/.test(d)) return 'transport'
  if (/netflix|spotify|game|cinema|bioskop|youtube|disney|vidio|prime/.test(d)) return 'entertainment'
  if (/tokopedia|shopee|lazada|toko|belanja|beli|market|alfamart|indomaret|supermarket/.test(d)) return 'shopping'
  if (/listrik|pln|air|pdam|internet|telkom|indihome|wifi|pulsa|token|tagihan|bpjs|cicilan/.test(d)) return 'bills'
  if (/dokter|apotek|farmasi|obat|rs |klinik|rumah sakit|kimia farma|guardian/.test(d)) return 'health'
  if (/kuliah|sekolah|spp|buku|kursus|les|ukt|biaya pendidikan/.test(d)) return 'education'
  return 'other'
}

// ─── format detection ─────────────────────────────────────────────────────────
//
// Priority matters: BRI must come before BNI because BRI (with Referensi + Debit + Kredit
// columns) would otherwise match the BNI "has debit AND kredit" rule.

function detectFormat(headers) {
  const h = headers.map(x => String(x).toLowerCase().trim())
  // BCA: exported with CBG/Mata Uang columns, or simpler Tgl/Uraian format
  if (h.includes('cbg') || h.includes('mata uang')) return 'bca'
  if (h.includes('tgl') && h.includes('uraian')) return 'bca'
  // Mandiri: "Tanggal Transaksi" + amount column (Jumlah or Nominal)
  if (h.some(x => x.includes('tanggal transaksi')) && h.some(x => x === 'jumlah' || x === 'nominal')) return 'mandiri'
  // BRI: has Referensi column, OR DB/CR-style indicator
  if (h.includes('referensi') || h.some(x => x.includes('db/cr') || x.includes('cr/db') || x.includes('d/k'))) return 'bri'
  // BNI: separate Debit/Kredit columns, OR signed Nominal + Keterangan
  if (h.includes('debit') && h.includes('kredit')) return 'bni'
  if (h.includes('nominal') && h.includes('keterangan')) return 'bni'
  return 'generic'
}

// ─── per-row parser ───────────────────────────────────────────────────────────

function rowToTransaction(row, headers, format) {
  const get = (...keys) => {
    for (const k of keys) {
      const found = headers.find(h => h.toLowerCase().trim() === k.toLowerCase())
      if (found !== undefined && row[found] !== undefined && row[found] !== '') return row[found]
    }
    return ''
  }

  let date, description, amount, type, reference = null

  switch (format) {
    case 'bca': {
      date = parseDate(get('Tgl', 'Tanggal', 'tgl', 'tanggal'))
      description = String(get('Uraian', 'Keterangan', 'uraian', 'keterangan') || '').trim()
      // New BCA format: separate Jumlah Debit / Jumlah Kredit columns
      const debitBca = Math.abs(parseAmount(get('Jumlah Debit', 'jumlah debit')))
      const kreditBca = Math.abs(parseAmount(get('Jumlah Kredit', 'jumlah kredit')))
      if (kreditBca > 0) {
        amount = kreditBca; type = 'income'
      } else if (debitBca > 0) {
        amount = debitBca; type = 'expense'
      } else {
        // Fallback: single signed Jumlah column (negative = debit/expense)
        const rawAmt = get('Jumlah', 'jumlah')
        const parsed = parseAmount(rawAmt)
        amount = Math.abs(parsed)
        type = String(rawAmt).includes('(') || parsed < 0 ? 'expense' : 'income'
      }
      break
    }

    case 'mandiri': {
      date = parseDate(get('Tanggal Transaksi', 'tanggal transaksi'))
      description = String(get('Deskripsi', 'deskripsi', 'Keterangan', 'keterangan') || '').trim()
      const nominal = parseAmount(get('Jumlah', 'jumlah', 'Nominal', 'nominal'))
      amount = Math.abs(nominal)
      // Mandiri exports often have a Tipe column (K=kredit, D=debit); fall back to sign
      const tipe = String(get('Tipe', 'tipe', 'Jenis', 'jenis') || '')
      type = /kredit|cr|^k$/i.test(tipe) ? 'income' : nominal >= 0 ? 'income' : 'expense'
      break
    }

    case 'bri': {
      date = parseDate(get('Tanggal', 'tanggal'))
      description = String(get('Keterangan', 'keterangan') || '').trim()
      reference = String(get('Referensi', 'referensi', 'No. Referensi', 'no. referensi') || '').trim() || null
      // BRI exports: separate Debit / Kredit columns (empty cell = 0)
      const debitBri = Math.abs(parseAmount(get('Debit', 'debit')))
      const kreditBri = Math.abs(parseAmount(get('Kredit', 'kredit')))
      if (kreditBri > 0) {
        amount = kreditBri; type = 'income'
      } else if (debitBri > 0) {
        amount = debitBri; type = 'expense'
      } else {
        // Older BRI format with DB/CR indicator column
        amount = Math.abs(parseAmount(get('Jumlah', 'jumlah', 'Nominal', 'nominal')))
        const dbcr = String(get('DB/CR', 'db/cr', 'CR/DB', 'D/K') || '').toLowerCase()
        type = /kr|cr|^k$/.test(dbcr) ? 'income' : 'expense'
      }
      break
    }

    case 'bni': {
      date = parseDate(get('Tanggal', 'tanggal'))
      description = String(get('Keterangan', 'keterangan', 'Deskripsi') || '').trim()
      const debitBni = parseAmount(get('Debit', 'debit'))
      const kreditBni = parseAmount(get('Kredit', 'kredit'))
      if (kreditBni > 0) {
        amount = kreditBni; type = 'income'
      } else if (debitBni > 0) {
        amount = debitBni; type = 'expense'
      } else {
        // BNI signed Nominal format: +5000000 (income) or -500000 (expense)
        const nominal = parseAmount(get('Nominal', 'nominal'))
        amount = Math.abs(nominal)
        type = nominal >= 0 ? 'income' : 'expense'
      }
      break
    }

    default: {
      date = parseDate(get('Tanggal', 'Date', 'tanggal'))
      description = String(get('Keterangan', 'Description', 'Deskripsi', 'Nama', 'keterangan') || '').trim()
      const rawAmt = get('Jumlah', 'Amount', 'Nominal', 'jumlah')
      const parsed = parseAmount(rawAmt)
      amount = Math.abs(parsed)
      const tipeCol = String(get('Tipe', 'Type', 'Jenis') || '')
      if (tipeCol) {
        type = /income|pemasukan|kredit|cr/i.test(tipeCol) ? 'income' : 'expense'
      } else {
        type = parsed < 0 ? 'expense' : 'income'
      }
    }
  }

  if (!amount || isNaN(amount) || amount <= 0) return null

  return {
    date,
    description,
    amount,
    type,
    category: guessCategory(description, type),
    reference,
    original_data: row,
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

const BANK_DISPLAY = { bca: 'BCA', mandiri: 'Mandiri', bni: 'BNI', bri: 'BRI', generic: 'Terdeteksi Otomatis' }
const BANK_SOURCE  = { bca: 'bca', mandiri: 'mandiri', bni: 'bni', bri: 'bri', generic: 'manual' }

export async function parseBankFile(file) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Ukuran file melebihi 5 MB. Pisah atau kompres file terlebih dahulu.`)
  }

  if (file.name.split('.').pop().toLowerCase() === 'pdf') {
    const { parsePdfFile } = await import('./pdfParser.js')
    return parsePdfFile(file)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        // Find header row by scanning the first 20 rows
        let headerIdx = 0
        for (let i = 0; i < Math.min(allRows.length, 20); i++) {
          const joined = allRows[i].join(' ').toLowerCase()
          if (/tanggal|date|keterangan|jumlah|nominal|debit|uraian|tgl/.test(joined)) {
            headerIdx = i
            break
          }
        }

        const headers = allRows[headerIdx].map(h => String(h).trim()).filter(Boolean)
        const format = detectFormat(headers)

        const dataRows = allRows.slice(headerIdx + 1).filter(row => row.some(c => c !== '' && c !== null))

        if (dataRows.length > MAX_ROWS) {
          return reject(new Error(`File mengandung ${dataRows.length} baris — maksimum ${MAX_ROWS} per import.`))
        }

        const transactions = dataRows
          .map(row => {
            const obj = {}
            headers.forEach((h, i) => { obj[h] = row[i] })
            return rowToTransaction(obj, headers, format)
          })
          .filter(Boolean)

        resolve({
          transactions,
          bank: BANK_DISPLAY[format] || 'Otomatis',
          source: BANK_SOURCE[format] || 'manual',
        })
      } catch (err) {
        reject(new Error('File tidak dapat diproses. Pastikan file CSV atau Excel valid.'))
      }
    }
    reader.onerror = () => reject(new Error('Gagal membaca file.'))
    reader.readAsArrayBuffer(file)
  })
}

import { useState, useRef, useCallback } from 'react'
import { parseBankFile } from '../../utils/bankParser'
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  BANK_CATEGORIES,
  bankNameToCategoryId,
} from '../../constants/categories'
import { formatCurrency, formatDate } from '../../utils/formatCurrency'

const STEP_UPLOAD = 'upload'
const STEP_PREVIEW = 'preview'

export default function ImportMutasiModal({ onClose, onImport }) {
  const [step, setStep] = useState(STEP_UPLOAD)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [bank, setBank] = useState('')
  const [bankCatId, setBankCatId] = useState('bank')
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState(null)  // { bank, source, fileName, totalParsed }
  const fileRef = useRef()

  const processFile = useCallback(async (file) => {
    const allowed = ['.csv', '.xlsx', '.xls', '.pdf']
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowed.includes(ext)) {
      setError('Format tidak didukung. Gunakan file PDF, CSV, atau Excel (.xlsx / .xls).')
      return
    }
    setParsing(true)
    setError('')
    try {
      const result = await parseBankFile(file)
      if (result.transactions.length === 0) {
        setError('Tidak ada transaksi yang berhasil terbaca. Periksa format file.')
        setParsing(false)
        return
      }
      const catId = bankNameToCategoryId(result.bank)
      setBank(result.bank)
      setBankCatId(catId)
      setMeta({ bank: result.bank, source: result.source, fileName: file.name, totalParsed: result.transactions.length })
      setRows(result.transactions.map((t, i) => ({
        ...t,
        _id: i,
        category: catId,
        source: result.source,
      })))
      setStep(STEP_PREVIEW)
    } catch (err) {
      setError(err.message)
    } finally {
      setParsing(false)
    }
  }, [])

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => {
      if (r._id !== id) return r
      const updated = { ...r, [field]: value }
      if (field === 'type' && BANK_CATEGORIES.some(b => b.id === r.category)) {
        updated.category = r.category
      }
      return updated
    }))
  }

  function removeRow(id) {
    setRows(prev => prev.filter(r => r._id !== id))
  }

  const totalIncome  = rows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const totalExpense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const bankCat = BANK_CATEGORIES.find(b => b.id === bankCatId)
  const hasReference = rows.some(r => r.reference)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${step === STEP_PREVIEW ? 'modal-xl' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">
            {step === STEP_UPLOAD ? '📤 Import Mutasi Bank' : `📋 Preview — ${rows.length} transaksi ditemukan`}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {step === STEP_UPLOAD && (
          <div>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              Dukung format mutasi dari <strong>BCA, Mandiri, BNI, BRI</strong>, dan format CSV umum.
              File diproses di browser — tidak dikirim ke server. Maks <strong>5 MB</strong>, <strong>1.000 baris</strong>.
            </p>

            {error && <div className="alert alert-error">⚠ {error}</div>}

            <div
              className={`dropzone${dragging ? ' dropzone-active' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              {parsing ? (
                <>
                  <div className="spinner" style={{ margin: '0 auto 12px' }} />
                  <p className="dropzone-text">Membaca file...</p>
                </>
              ) : (
                <>
                  <div className="dropzone-icon">📂</div>
                  <p className="dropzone-text">Klik atau seret file ke sini</p>
                  <p className="dropzone-hint">PDF, CSV, XLSX, XLS • Maksimal 5 MB • 1.000 baris</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls,.pdf"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>

            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 12, textAlign: 'center' }}>
              ⚠ PDF hanya berfungsi untuk rekening koran digital (teks asli), bukan scan/foto.
            </p>
            <div className="import-bank-badges">
              {['BCA', 'Mandiri', 'BNI', 'BRI', 'PDF', 'CSV Umum'].map(b => (
                <span key={b} className="bank-badge">{b}</span>
              ))}
            </div>
          </div>
        )}

        {step === STEP_PREVIEW && (
          <div>
            <div className="import-summary-row">
              <div className="import-summary-chip">
                🏦 Bank: <strong>{bank}</strong>
              </div>
              <div className="import-summary-chip income">
                ↑ Pemasukan: <strong>{formatCurrency(totalIncome)}</strong>
              </div>
              <div className="import-summary-chip expense">
                ↓ Pengeluaran: <strong>{formatCurrency(totalExpense)}</strong>
              </div>
            </div>

            {bankCat && (
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
                Semua transaksi dikategorikan sebagai{' '}
                <span className="cat-chip" style={{ background: bankCat.bg, color: bankCat.color, display: 'inline-flex', padding: '2px 8px' }}>
                  {bankCat.icon} {bankCat.label}
                </span>{' '}
                secara default. Ubah per baris jika diperlukan.
              </p>
            )}

            <div className="import-table-wrap">
              <table className="import-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Keterangan</th>
                    {hasReference && <th>Referensi</th>}
                    <th>Tipe</th>
                    <th>Kategori</th>
                    <th style={{ textAlign: 'right' }}>Jumlah</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const regularCats = row.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
                    return (
                      <tr key={row._id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatDate(row.date)}</td>
                        <td style={{ fontSize: 12, maxWidth: 200 }}>
                          <span title={row.description}>{row.description || '-'}</span>
                        </td>
                        {hasReference && (
                          <td style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>
                            {row.reference || '—'}
                          </td>
                        )}
                        <td>
                          <select
                            className="import-select import-select-type"
                            value={row.type}
                            onChange={e => updateRow(row._id, 'type', e.target.value)}
                            style={{ color: row.type === 'income' ? '#10B981' : '#EF4444' }}
                          >
                            <option value="income">Pemasukan</option>
                            <option value="expense">Pengeluaran</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="import-select"
                            value={row.category}
                            onChange={e => updateRow(row._id, 'category', e.target.value)}
                          >
                            <optgroup label="🏦 Sumber Bank">
                              {BANK_CATEGORIES.map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                              ))}
                            </optgroup>
                            <optgroup label="📂 Kategori Lainnya">
                              {regularCats.map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                              ))}
                            </optgroup>
                          </select>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, fontSize: 13 }}>
                          <span style={{ color: row.type === 'income' ? '#10B981' : '#EF4444' }}>
                            {row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => removeRow(row._id)}
                            title="Hapus baris ini"
                          >×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 justify-end" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => { setStep(STEP_UPLOAD); setRows([]) }}>
                ← Ganti File
              </button>
              <button
                className="btn btn-primary"
                onClick={() => onImport(rows, meta)}
                disabled={rows.length === 0}
              >
                Import {rows.length} Transaksi →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

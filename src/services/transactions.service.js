import { supabase } from '../lib/supabase'

export async function getTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) throw error
  return data
}

export async function addTransaction(transaction) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transaction)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function bulkAddTransactions(transactions) {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select()
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllTransactions(userId) {
  const { error } = await supabase.from('transactions').delete().eq('user_id', userId)
  if (error) throw error
}

export async function logImportHistory(userId, { bank, fileName, totalRows, importedRows }) {
  const { error } = await supabase.from('import_history').insert({
    user_id: userId,
    bank,
    file_name: fileName,
    total_rows: totalRows,
    imported_rows: importedRows,
  })
  if (error) throw error
}

export async function getSummary(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount')
    .eq('user_id', userId)
  if (error) throw error

  const income = data
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const expense = data
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  return { income, expense, balance: income - expense }
}

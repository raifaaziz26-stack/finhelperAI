export const EXPENSE_CATEGORIES = [
  { id: 'food',          label: 'Makanan',    icon: '🍜', color: '#F87171', bg: '#FEF2F2' },
  { id: 'transport',     label: 'Transport',  icon: '🚗', color: '#60A5FA', bg: '#EFF6FF' },
  { id: 'entertainment', label: 'Hiburan',    icon: '🎮', color: '#A78BFA', bg: '#F5F3FF' },
  { id: 'shopping',      label: 'Belanja',    icon: '🛍️', color: '#FB923C', bg: '#FFF7ED' },
  { id: 'bills',         label: 'Tagihan',    icon: '💡', color: '#34D399', bg: '#ECFDF5' },
  { id: 'health',        label: 'Kesehatan',  icon: '❤️', color: '#F472B6', bg: '#FDF2F8' },
  { id: 'education',     label: 'Pendidikan', icon: '🎓', color: '#FBBF24', bg: '#FFFBEB' },
  { id: 'other',         label: 'Lainnya',    icon: '📁', color: '#9CA3AF', bg: '#F9FAFB' },
]

export const INCOME_CATEGORIES = [
  { id: 'salary',         label: 'Gaji',       icon: '💼', color: '#10B981', bg: '#ECFDF5' },
  { id: 'freelance',      label: 'Freelance',  icon: '💻', color: '#10B981', bg: '#ECFDF5' },
  { id: 'investment',     label: 'Investasi',  icon: '📈', color: '#10B981', bg: '#ECFDF5' },
  { id: 'gift',           label: 'Hadiah',     icon: '🎁', color: '#10B981', bg: '#ECFDF5' },
  { id: 'other_income',   label: 'Lainnya',    icon: '📁', color: '#10B981', bg: '#ECFDF5' },
]

export function getCategoryById(id, type = 'expense') {
  const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  return list.find(c => c.id === id) || EXPENSE_CATEGORIES.find(c => c.id === 'other')
}

export default function Button({ children, variant = 'primary', size = '', full = false, ...props }) {
  const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, full && 'btn-full']
    .filter(Boolean).join(' ')
  return <button className={cls} {...props}>{children}</button>
}

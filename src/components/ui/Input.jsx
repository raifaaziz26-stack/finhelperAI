export default function Input({ label, id, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      <input id={id} className="form-input" {...props} />
    </div>
  )
}

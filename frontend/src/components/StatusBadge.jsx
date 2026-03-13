export default function StatusBadge({ status }) {
  if (status === 'up') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        🟢 Up
      </span>
    )
  }
  if (status === 'down') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 animate-pulse">
        🔴 Down
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      ⚪ Unknown
    </span>
  )
}

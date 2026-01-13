interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
}

export default function Toast({ message, type }: ToastProps) {
  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
  }[type]

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }[type]

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3`}>
        <span className="text-lg">{icon}</span>
        <span className="font-medium">{message}</span>
      </div>
    </div>
  )
}

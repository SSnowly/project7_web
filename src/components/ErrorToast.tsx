import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, X } from 'lucide-react'
import { useEffect } from 'react'

interface ErrorToastProps {
  message: string
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export default function ErrorToast({ message, isVisible, onClose, duration = 5000 }: ErrorToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20, x: 20 }}
          className="fixed top-4 right-4 z-50"
        >
          <div className="flex items-center gap-3 bg-red-500/10 backdrop-blur-sm border border-red-500/20 text-red-500 px-4 py-3 rounded-lg shadow-lg">
            <AlertCircle size={18} />
            <p className="text-sm font-medium pr-2">{message}</p>
            <button onClick={onClose} className="p-1 hover:bg-red-500/10 rounded-full transition-colors">
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

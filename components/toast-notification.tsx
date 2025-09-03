"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { X, AlertCircle, CheckCircle, Info } from "lucide-react"

interface ToastNotificationProps {
  message: string
  type?: "error" | "success" | "info"
  duration?: number
  onClose?: () => void
}

export function ToastNotification({ message, type = "info", duration = 4000, onClose }: ToastNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onClose?.(), 200)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => onClose?.(), 200)
  }

  const getIcon = () => {
    switch (type) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-destructive" />
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      default:
        return <Info className="w-4 h-4 text-primary" />
    }
  }

  const getStyles = () => {
    switch (type) {
      case "error":
        return "bg-destructive text-destructive-foreground"
      case "success":
        return "bg-green-600 text-white"
      default:
        return "zoom-toast text-muted-foreground"
    }
  }

  if (!isVisible) return null

  return (
    <Card
      className={`
        px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-top-2 duration-200
        ${getStyles()}
        ${!isVisible ? "animate-out slide-out-to-top-2" : ""}
      `}
    >
      <div className="flex items-center gap-3">
        {getIcon()}
        <span className="text-sm font-medium flex-1">{message}</span>
        {onClose && (
          <button onClick={handleClose} className="p-1 hover:bg-black/10 rounded transition-colors">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </Card>
  )
}

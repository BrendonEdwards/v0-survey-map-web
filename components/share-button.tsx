"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Share2, Check } from "lucide-react"

interface ShareButtonProps {
  onGetShareUrl: () => string
  className?: string
}

export function ShareButton({ onGetShareUrl, className = "" }: ShareButtonProps) {
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const shareUrl = onGetShareUrl()

    // Try native sharing first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Survey Map",
          text: "Check out this survey map location",
          url: shareUrl,
        })
        return
      } catch (error) {
        // Fall back to copy to clipboard
      }
    }

    // Copy to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = shareUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleShare}
        className="p-2 hover:bg-accent transition-colors"
        title="Share current view"
      >
        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
      </Button>

      {copied && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="px-2 py-1 bg-green-600 text-white text-xs rounded shadow-lg">Copied!</Card>
        </div>
      )}
    </div>
  )
}

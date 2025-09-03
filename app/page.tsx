"use client"

import { useRef, useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { MobileHeader } from "@/components/mobile-header"
import { ToastNotification } from "@/components/toast-notification"
import { ShareButton } from "@/components/share-button"
import { useUrlState } from "@/hooks/use-url-state"

// Dynamically import map components to avoid SSR issues
const MapContainer = dynamic(() => import("@/components/map-container"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-muted flex items-center justify-center">
      <div className="text-muted-foreground">Loading map...</div>
    </div>
  ),
})

export default function SurveyMapPage() {
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [currentMapState, setCurrentMapState] = useState({ zoom: 4, lat: 39.8283, lng: -98.5795 })
  const mapRef = useRef<any>(null)
  const { parseUrlState, updateUrlState, getShareableUrl, clearUrlState } = useUrlState()

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.message || ""
      // Suppress querySelector errors that contain hash-like patterns
      if (
        message.includes("querySelector") &&
        message.includes("not a valid selector") &&
        message.includes("#") &&
        (message.includes("/") || message.includes("."))
      ) {
        console.warn("Suppressed querySelector error with hash value:", message)
        event.preventDefault()
        return false
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || event.reason || ""
      if (
        typeof reason === "string" &&
        reason.includes("querySelector") &&
        reason.includes("not a valid selector") &&
        reason.includes("#") &&
        (reason.includes("/") || reason.includes("."))
      ) {
        console.warn("Suppressed querySelector promise rejection:", reason)
        event.preventDefault()
      }
    }

    window.addEventListener("error", handleError)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("error", handleError)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

  useEffect(() => {
    const urlState = parseUrlState()

    // Handle initial cell ID from URL
    if (urlState.cellId && mapRef.current) {
      const timer = setTimeout(() => {
        handleSearchById(urlState.cellId!)
      }, 1000)

      return () => clearTimeout(timer)
    }

    // Set initial map state from URL if available
    if (urlState.zoom && urlState.lat && urlState.lng) {
      setCurrentMapState({
        zoom: urlState.zoom,
        lat: urlState.lat,
        lng: urlState.lng,
      })
    }
  }, [parseUrlState])

  const handleSearchById = async (cellId: string) => {
    if (!mapRef.current) return false

    setIsSearching(true)
    setSearchError(null)

    try {
      const found = await mapRef.current.searchAndFlyTo(cellId.trim())
      if (!found) {
        setSearchError(`Cell ID "${cellId}" not found`)
        return false
      }

      // Update URL state with cell ID
      updateUrlState({ cellId: cellId.trim() })

      return true
    } catch (error) {
      setSearchError("Search failed")
      return false
    } finally {
      setIsSearching(false)
    }
  }

  const handleMapStateChange = (newState: { zoom: number; lat: number; lng: number }) => {
    setCurrentMapState(newState)
    updateUrlState(newState)
  }

  const handleClearSearch = () => {
    updateUrlState({ cellId: "" })
  }

  const getShareUrl = (): string => {
    const urlState = parseUrlState()
    return getShareableUrl({
      zoom: currentMapState.zoom,
      lat: currentMapState.lat,
      lng: currentMapState.lng,
      cellId: urlState.cellId,
    })
  }

  const getSuggestions = (query: string): string[] => {
    return mapRef.current?.getSuggestions?.(query) || []
  }

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      {/* Responsive Header */}
      <MobileHeader
        onSearch={handleSearchById}
        getSuggestions={getSuggestions}
        isSearching={isSearching}
        onClearSearch={handleClearSearch}
      />

      {/* Share Button - Desktop */}
      <div className="hidden md:block absolute top-4 left-4 z-[1000]">
        <ShareButton onGetShareUrl={getShareUrl} />
      </div>

      {/* Search Error Toast */}
      {searchError && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000]">
          <ToastNotification message={searchError} type="error" duration={4000} onClose={() => setSearchError(null)} />
        </div>
      )}

      {/* Map Container */}
      <div className="w-full h-full pt-16">
        <MapContainer ref={mapRef} onMapStateChange={handleMapStateChange} initialState={currentMapState} />
      </div>
    </div>
  )
}

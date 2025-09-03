"use client"

import { useCallback } from "react"

interface MapState {
  zoom: number
  lat: number
  lng: number
  cellId?: string
}

export function useUrlState() {
  const parseUrlState = useCallback((): Partial<MapState> => {
    const state: Partial<MapState> = {}

    try {
      const hash = window.location.hash.substring(1)
      if (hash) {
        // Support both old format (zoom/lat/lng) and new format (map_zoom_lat_lng)
        if (hash.includes("/")) {
          // Old format: zoom/lat/lng
          const parts = hash.split("/")
          if (parts.length === 3) {
            const [zoom, lat, lng] = parts.map(Number)
            if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
              state.zoom = zoom
              state.lat = lat
              state.lng = lng
            }
          }
        } else if (hash.startsWith("map_")) {
          // New CSS-safe format: map_zoom_lat_lng (coordinates as integers)
          const parts = hash.substring(4).split("_")
          if (parts.length === 3) {
            const zoom = Number(parts[0])
            const lat = Number(parts[1]) / 100000 // Convert back from integer
            const lng = Number(parts[2]) / 100000 // Convert back from integer
            if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
              state.zoom = zoom
              state.lat = lat
              state.lng = lng
            }
          }
        }
      }

      // Parse query parameters for cell ID
      const urlParams = new URLSearchParams(window.location.search)
      const cellId = urlParams.get("id")
      if (cellId) {
        state.cellId = cellId.trim()
      }
    } catch (error) {
      console.error("Error parsing URL state:", error)
      // Return empty state if parsing fails
    }

    return state
  }, [])

  const updateUrlState = useCallback((newState: Partial<MapState>) => {
    try {
      const url = new URL(window.location.href)

      // Update hash for map position
      if (newState.zoom !== undefined && newState.lat !== undefined && newState.lng !== undefined) {
        const zoom = Math.round(newState.zoom)
        const lat = Math.round(newState.lat * 100000) // Store as integer (5 decimal places)
        const lng = Math.round(newState.lng * 100000) // Store as integer (5 decimal places)

        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
          url.hash = `#map_${zoom}_${lat}_${lng}`
        }
      }

      // Update query parameters for cell ID
      if (newState.cellId !== undefined) {
        if (newState.cellId) {
          url.searchParams.set("id", newState.cellId)
        } else {
          url.searchParams.delete("id")
        }
      }

      // Update URL without triggering page reload
      window.history.replaceState({}, "", url.toString())
    } catch (error) {
      console.error("Error updating URL state:", error)
    }
  }, [])

  const getShareableUrl = useCallback((state: MapState): string => {
    const url = new URL(window.location.origin + window.location.pathname)

    const lat = Math.round(state.lat * 100000)
    const lng = Math.round(state.lng * 100000)
    url.hash = `#map_${state.zoom}_${lat}_${lng}`

    // Add cell ID to query if present
    if (state.cellId) {
      url.searchParams.set("id", state.cellId)
    }

    return url.toString()
  }, [])

  const clearUrlState = useCallback(() => {
    const url = new URL(window.location.href)
    url.hash = ""
    url.searchParams.delete("id")
    window.history.replaceState({}, "", url.toString())
  }, [])

  return {
    parseUrlState,
    updateUrlState,
    getShareableUrl,
    clearUrlState,
  }
}

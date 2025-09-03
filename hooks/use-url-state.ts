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

    // Parse hash for map position (#zoom/lat/lng)
    const hash = window.location.hash.substring(1)
    if (hash) {
      const parts = hash.split("/")
      if (parts.length === 3) {
        const [zoom, lat, lng] = parts.map(Number)
        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
          state.zoom = zoom
          state.lat = lat
          state.lng = lng
        }
      }
    }

    // Parse query parameters for cell ID
    const urlParams = new URLSearchParams(window.location.search)
    const cellId = urlParams.get("id")
    if (cellId) {
      state.cellId = cellId
    }

    return state
  }, [])

  const updateUrlState = useCallback((newState: Partial<MapState>) => {
    const url = new URL(window.location.href)

    // Update hash for map position
    if (newState.zoom !== undefined && newState.lat !== undefined && newState.lng !== undefined) {
      url.hash = `#${newState.zoom}/${newState.lat.toFixed(5)}/${newState.lng.toFixed(5)}`
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
  }, [])

  const getShareableUrl = useCallback((state: MapState): string => {
    const url = new URL(window.location.origin + window.location.pathname)

    // Add map position to hash
    url.hash = `#${state.zoom}/${state.lat.toFixed(5)}/${state.lng.toFixed(5)}`

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

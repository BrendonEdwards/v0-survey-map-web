"use client"

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Layers } from "lucide-react"
import { MapStats } from "./map-stats"
import { ToastNotification } from "./toast-notification"

declare global {
  interface Window {
    L: any
  }
}

interface SurveyPoint {
  id: string
  lat: number
  lng: number
  cell_id: string
}

const sanitizeCssClass = (str: string): string => {
  // Remove or replace invalid CSS characters
  return str.replace(/[^a-zA-Z0-9_-]/g, "_")
}

type MapContainerProps = {
  onMapStateChange?: (state: { zoom: number; lat: number; lng: number }) => void
  initialState?: { zoom: number; lat: number; lng: number }
}

export interface MapContainerRef {
  searchAndFlyTo: (cellId: string) => Promise<boolean>
  getSuggestions: (query: string) => string[]
}

const MapContainer = forwardRef<MapContainerRef, MapContainerProps>(({ onMapStateChange, initialState }, ref) => {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const surveyLayerRef = useRef<any>(null)
  const canvasLayerRef = useRef<any>(null)
  const [surveyPoints, setSurveyPoints] = useState<SurveyPoint[]>([])
  const [currentZoom, setCurrentZoom] = useState(10)
  const [showZoomToast, setShowZoomToast] = useState(false)
  const [currentBasemap, setCurrentBasemap] = useState<"osm" | "humanitarian">("osm")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  useEffect(() => {
    const loadLeaflet = async () => {
      if (typeof window !== "undefined" && !window.L) {
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        script.crossOrigin = ""

        script.onload = () => {
          // Fix for default markers in Leaflet
          if (window.L) {
            delete (window.L.Icon.Default.prototype as any)._getIconUrl
            window.L.Icon.Default.mergeOptions({
              iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
              iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
              shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
            })
            setLeafletLoaded(true)
          }
        }

        document.head.appendChild(script)
      } else if (window.L) {
        setLeafletLoaded(true)
      }
    }

    loadLeaflet()
  }, [])

  // Basemap layers
  const createBasemaps = () => {
    if (!window.L) return {}

    return {
      osm: window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }),
      humanitarian: window.L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team",
      }),
    }
  }

  useImperativeHandle(ref, () => ({
    searchAndFlyTo: async (cellId: string): Promise<boolean> => {
      const point = surveyPoints.find((p) => p.cell_id.toLowerCase() === cellId.toLowerCase())

      if (point && mapRef.current && window.L) {
        mapRef.current.flyTo([point.lat, point.lng], 16, {
          duration: 1.5,
        })

        setTimeout(() => {
          // Find the canvas element and trigger highlight
          if (surveyLayerRef.current && mapRef.current?.hasLayer(surveyLayerRef.current)) {
            // Create a temporary highlight marker
            const highlightMarker = window.L.circleMarker([point.lat, point.lng], {
              radius: 12,
              fillColor: "#fbbf24", // yellow-400
              color: "#f59e0b", // yellow-500
              weight: 3,
              opacity: 1,
              fillOpacity: 0.6,
              className: "survey-point-highlight",
            })

            highlightMarker.addTo(mapRef.current)

            // Remove highlight after animation
            setTimeout(() => {
              if (mapRef.current && mapRef.current.hasLayer(highlightMarker)) {
                mapRef.current.removeLayer(highlightMarker)
              }
            }, 2000)
          }
        }, 1500)

        return true
      }
      return false
    },
    getSuggestions: (query: string): string[] => {
      if (!query.trim()) return []

      const lowerQuery = query.toLowerCase()
      return surveyPoints
        .filter((point) => point.cell_id.toLowerCase().includes(lowerQuery))
        .map((point) => point.cell_id)
        .sort()
    },
  }))

  const loadGeoJSONData = async (): Promise<SurveyPoint[]> => {
    try {
      console.log("[v0] Starting GeoJSON data load...")
      const response = await fetch("/centroid.geojson")
      if (!response.ok) {
        throw new Error(`Failed to load GeoJSON: ${response.statusText}`)
      }

      const geojsonData = await response.json()
      console.log("[v0] GeoJSON data loaded:", geojsonData)

      if (!geojsonData.features || !Array.isArray(geojsonData.features)) {
        throw new Error("Invalid GeoJSON format: missing features array")
      }

      const points: SurveyPoint[] = []

      geojsonData.features.forEach((feature: any, index: number) => {
        if (feature.geometry?.type === "Point" && feature.geometry.coordinates) {
          const [lng, lat] = feature.geometry.coordinates
          const cellId = feature.properties?.cell_id || feature.properties?.name || `Point_${index}`

          if (!isNaN(lat) && !isNaN(lng)) {
            const point = {
              id: `point_${index}`,
              lat: lat,
              lng: lng,
              cell_id: cellId,
            }
            points.push(point)
            console.log("[v0] Added point:", point)
          } else {
            console.log("[v0] Invalid coordinates for feature:", feature)
          }
        }
      })

      console.log("[v0] Total points parsed from GeoJSON:", points.length)
      return points
    } catch (error) {
      console.error("[v0] Error loading GeoJSON data:", error)
      throw error
    }
  }

  const createSurveyPointsLayer = (points: SurveyPoint[]) => {
    if (!window.L) return null

    console.log("[v0] Creating survey points layer with", points.length, "points")
    const layerGroup = window.L.layerGroup()

    points.forEach((point, index) => {
      console.log("[v0] Creating marker for point:", point.cell_id, "at", point.lat, point.lng)

      // Create circle marker with canvas renderer for performance
      const marker = window.L.circleMarker([point.lat, point.lng], {
        radius: 6,
        fillColor: "#dc2626", // red-600
        color: "#dc2626",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
        renderer: canvasLayerRef.current || undefined,
      })

      const sanitizedCellId = sanitizeCssClass(point.cell_id)

      // Create label with white halo effect
      const labelIcon = window.L.divIcon({
        className: `survey-point-label survey-point-${sanitizedCellId}`,
        html: `<div class="survey-point-label" data-cell-id="${point.cell_id}">${point.cell_id}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, -8], // Position label above the point
      })

      const labelMarker = window.L.marker([point.lat, point.lng], {
        icon: labelIcon,
        interactive: false,
      })

      // Add both marker and label to layer group
      layerGroup.addLayer(marker)
      layerGroup.addLayer(labelMarker)
    })

    console.log("[v0] Survey points layer created with", layerGroup.getLayers().length, "total layers")
    return layerGroup
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !leafletLoaded || !window.L) return

    try {
      const map = window.L.map(mapContainerRef.current, {
        center: initialState ? [initialState.lat, initialState.lng] : [39.8283, -98.5795], // Center of US
        zoom: initialState?.zoom || 4,
        zoomControl: false,
        preferCanvas: true,
      })

      const canvasRenderer = window.L.canvas()
      canvasLayerRef.current = canvasRenderer

      // Add zoom control to bottom right
      window.L.control.zoom({ position: "bottomright" }).addTo(map)

      // Add initial basemap
      const basemaps = createBasemaps()
      basemaps[currentBasemap].addTo(map)

      const safeEventHandler = (callback: () => void) => {
        return () => {
          try {
            callback()
          } catch (error) {
            console.warn("[v0] Map event handler error:", error)
          }
        }
      }

      // Zoom event handler
      map.on(
        "zoomend",
        safeEventHandler(() => {
          const zoom = map.getZoom()
          setCurrentZoom(zoom)

          if (zoom >= 12 && surveyLayerRef.current) {
            if (!map.hasLayer(surveyLayerRef.current)) {
              map.addLayer(surveyLayerRef.current)
            }
            setShowZoomToast(false)
          } else if (surveyLayerRef.current) {
            if (map.hasLayer(surveyLayerRef.current)) {
              map.removeLayer(surveyLayerRef.current)
            }
            setShowZoomToast(true)
          }
        }),
      )

      // Handle URL hash for sharing
      const updateMapState = safeEventHandler(() => {
        const center = map.getCenter()
        const zoom = map.getZoom()

        // Update parent component with new state
        onMapStateChange?.({
          zoom,
          lat: center.lat,
          lng: center.lng,
        })
      })

      map.on("moveend", updateMapState)
      map.on("zoomend", updateMapState)

      if (!initialState) {
        try {
          const hash = window.location.hash.substring(1)
          if (hash) {
            let zoom, lat, lng

            if (hash.includes("/")) {
              // Old format: zoom/lat/lng
              const parts = hash.split("/")
              if (parts.length === 3) {
                ;[zoom, lat, lng] = parts.map(Number)
              }
            } else if (hash.startsWith("map_")) {
              const parts = hash.substring(4).split("_")
              if (parts.length === 3) {
                zoom = Number(parts[0])
                lat = Number(parts[1]) / 100000 // Convert back from integer
                lng = Number(parts[2]) / 100000 // Convert back from integer
              }
            }

            if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
              map.setView([lat, lng], zoom)
            }
          }
        } catch (error) {
          console.error("Error parsing URL hash:", error)
          // Continue with default view if hash parsing fails
        }
      }

      mapRef.current = map

      return () => {
        try {
          map.remove()
          mapRef.current = null
        } catch (error) {
          console.warn("[v0] Error cleaning up map:", error)
        }
      }
    } catch (error) {
      console.error("[v0] Error initializing map:", error)
      setLoadError("Failed to initialize map")
    }
  }, [leafletLoaded, initialState, onMapStateChange])

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log("[v0] Starting data load effect...")
        setIsLoading(true)
        setLoadError(null)

        const points = await loadGeoJSONData()
        console.log("[v0] Setting survey points:", points.length)
        setSurveyPoints(points)

        // Create survey points layer
        if (mapRef.current && window.L) {
          console.log("[v0] Map and Leaflet available, creating layer...")
          const surveyLayer = createSurveyPointsLayer(points)
          if (surveyLayer) {
            surveyLayerRef.current = surveyLayer
            console.log("[v0] Survey layer created and stored")

            // Only add layer if zoomed in enough
            const currentZoom = mapRef.current.getZoom()
            console.log("[v0] Current zoom level:", currentZoom)
            if (currentZoom >= 12) {
              console.log("[v0] Adding survey layer to map (zoom >= 12)")
              mapRef.current.addLayer(surveyLayer)
            } else {
              console.log("[v0] Not adding survey layer (zoom < 12)")
            }
          } else {
            console.log("[v0] Failed to create survey layer")
          }
        } else {
          console.log("[v0] Map or Leaflet not available")
        }

        console.log(`[v0] Loaded ${points.length} survey points from GeoJSON`)
      } catch (error) {
        console.error("[v0] Failed to load survey data:", error)
        setLoadError("Failed to load survey data")
      } finally {
        setIsLoading(false)
      }
    }

    if (mapRef.current && leafletLoaded) {
      console.log("[v0] Map and Leaflet ready, loading data...")
      loadData()
    } else {
      console.log("[v0] Waiting for map and Leaflet to be ready...")
    }
  }, [mapRef.current, leafletLoaded])

  // Switch basemap
  const switchBasemap = (newBasemap: "osm" | "humanitarian") => {
    if (!mapRef.current || !window.L) return

    const basemaps = createBasemaps()

    // Remove current basemap
    mapRef.current.removeLayer(basemaps[currentBasemap])

    // Add new basemap
    mapRef.current.addLayer(basemaps[newBasemap])

    setCurrentBasemap(newBasemap)
  }

  if (!leafletLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Card className="px-6 py-4 bg-card border border-border rounded-lg shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-foreground">Loading map library...</span>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-[1000]">
          <Card className="px-6 py-4 bg-card border border-border rounded-lg shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-foreground">Loading survey data...</span>
            </div>
          </Card>
        </div>
      )}

      {/* Load error */}
      {loadError && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000]">
          <ToastNotification message={loadError} type="error" duration={0} onClose={() => setLoadError(null)} />
        </div>
      )}

      {/* Zoom toast */}
      {showZoomToast && !isLoading && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-[1000]">
          <ToastNotification message="Zoom in to see survey points" type="info" duration={0} />
        </div>
      )}

      {/* Map Stats - Desktop only */}
      <div className="hidden lg:block absolute bottom-4 left-4 z-[1000]">
        <MapStats
          totalPoints={surveyPoints.length}
          visiblePoints={currentZoom >= 12 ? surveyPoints.length : 0}
          currentZoom={currentZoom}
          isLoading={isLoading}
        />
      </div>

      {/* Basemap control */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Card className="p-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 mb-1">
              <Layers className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">Basemap</span>
            </div>
            <Button
              size="sm"
              variant={currentBasemap === "osm" ? "default" : "ghost"}
              onClick={() => switchBasemap("osm")}
              className="text-xs h-7 px-2 transition-all duration-200"
            >
              Standard
            </Button>
            <Button
              size="sm"
              variant={currentBasemap === "humanitarian" ? "default" : "ghost"}
              onClick={() => switchBasemap("humanitarian")}
              className="text-xs h-7 px-2 transition-all duration-200"
            >
              Humanitarian
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
})

MapContainer.displayName = "MapContainer"

export default MapContainer

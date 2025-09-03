"use client"

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Layers } from "lucide-react"
import { MapStats } from "./map-stats"
import { ToastNotification } from "./toast-notification"

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

interface SurveyPoint {
  id: string
  lat: number
  lng: number
  cell_id: string
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
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const surveyLayerRef = useRef<L.LayerGroup | null>(null)
  const canvasLayerRef = useRef<L.Canvas | null>(null)
  const [surveyPoints, setSurveyPoints] = useState<SurveyPoint[]>([])
  const [currentZoom, setCurrentZoom] = useState(10)
  const [showZoomToast, setShowZoomToast] = useState(false)
  const [currentBasemap, setCurrentBasemap] = useState<"osm" | "humanitarian">("osm")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Basemap layers
  const basemaps = {
    osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }),
    humanitarian: L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors, Tiles style by Humanitarian OpenStreetMap Team",
    }),
  }

  useImperativeHandle(ref, () => ({
    searchAndFlyTo: async (cellId: string): Promise<boolean> => {
      const point = surveyPoints.find((p) => p.cell_id.toLowerCase() === cellId.toLowerCase())

      if (point && mapRef.current) {
        mapRef.current.flyTo([point.lat, point.lng], 16, {
          duration: 1.5,
        })

        setTimeout(() => {
          // Find the canvas element and trigger highlight
          if (surveyLayerRef.current && mapRef.current?.hasLayer(surveyLayerRef.current)) {
            // Create a temporary highlight marker
            const highlightMarker = L.circleMarker([point.lat, point.lng], {
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

  const loadKMLData = async (): Promise<SurveyPoint[]> => {
    try {
      // Load KML file
      const response = await fetch("/grid_centroid_lod_single.kml")
      if (!response.ok) {
        throw new Error(`Failed to load KML: ${response.statusText}`)
      }

      const kmlText = await response.text()

      // Parse KML to extract points
      const parser = new DOMParser()
      const kmlDoc = parser.parseFromString(kmlText, "text/xml")

      const placemarks = kmlDoc.getElementsByTagName("Placemark")
      const points: SurveyPoint[] = []

      for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i]
        const nameElement = placemark.getElementsByTagName("name")[0]
        const coordinatesElement = placemark.getElementsByTagName("coordinates")[0]

        if (nameElement && coordinatesElement) {
          const name = nameElement.textContent?.trim() || `Point_${i}`
          const coordsText = coordinatesElement.textContent?.trim()

          if (coordsText) {
            // KML coordinates are in format: longitude,latitude,altitude
            const coords = coordsText.split(",").map(Number)
            if (coords.length >= 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
              points.push({
                id: `point_${i}`,
                lat: coords[1], // latitude
                lng: coords[0], // longitude
                cell_id: name,
              })
            }
          }
        }
      }

      return points
    } catch (error) {
      console.error("Error loading KML data:", error)
      throw error
    }
  }

  const createSurveyPointsLayer = (points: SurveyPoint[]): L.LayerGroup => {
    const layerGroup = L.layerGroup()

    points.forEach((point) => {
      // Create circle marker with canvas renderer for performance
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: 6,
        fillColor: "#dc2626", // red-600
        color: "#dc2626",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
        renderer: canvasLayerRef.current || undefined,
      })

      // Add cell_id as data attribute for highlighting
      marker.getElement()?.setAttribute("data-cell-id", point.cell_id)

      // Create label with white halo effect
      const labelIcon = L.divIcon({
        className: "survey-point-label",
        html: `<div class="survey-point-label">${point.cell_id}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, -8], // Position label above the point
      })

      const labelMarker = L.marker([point.lat, point.lng], {
        icon: labelIcon,
        interactive: false,
      })

      // Add both marker and label to layer group
      layerGroup.addLayer(marker)
      layerGroup.addLayer(labelMarker)
    })

    return layerGroup
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: initialState ? [initialState.lat, initialState.lng] : [39.8283, -98.5795], // Center of US
      zoom: initialState?.zoom || 4,
      zoomControl: false,
      preferCanvas: true,
    })

    const canvasRenderer = L.canvas()
    canvasLayerRef.current = canvasRenderer

    // Add zoom control to bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map)

    // Add initial basemap
    basemaps[currentBasemap].addTo(map)

    // Zoom event handler
    map.on("zoomend", () => {
      const zoom = map.getZoom()
      setCurrentZoom(zoom)

      if (zoom >= 15 && surveyLayerRef.current) {
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
    })

    // Handle URL hash for sharing
    const updateMapState = () => {
      const center = map.getCenter()
      const zoom = map.getZoom()

      // Update parent component with new state
      onMapStateChange?.({
        zoom,
        lat: center.lat,
        lng: center.lng,
      })
    }

    map.on("moveend", updateMapState)
    map.on("zoomend", updateMapState)

    // Load initial view from URL hash if no initial state provided
    if (!initialState) {
      const hash = window.location.hash.substring(1)
      if (hash) {
        const parts = hash.split("/")
        if (parts.length === 3) {
          const [zoom, lat, lng] = parts.map(Number)
          if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
            map.setView([lat, lng], zoom)
          }
        }
      }
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [initialState, onMapStateChange])

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)

        const points = await loadKMLData()
        setSurveyPoints(points)

        // Create survey points layer
        if (mapRef.current) {
          const surveyLayer = createSurveyPointsLayer(points)
          surveyLayerRef.current = surveyLayer

          // Only add layer if zoomed in enough
          if (mapRef.current.getZoom() >= 15) {
            mapRef.current.addLayer(surveyLayer)
          }
        }

        console.log(`Loaded ${points.length} survey points from KML`)
      } catch (error) {
        console.error("Failed to load survey data:", error)
        setLoadError("Failed to load survey data")
      } finally {
        setIsLoading(false)
      }
    }

    if (mapRef.current) {
      loadData()
    }
  }, [mapRef.current])

  // Switch basemap
  const switchBasemap = (newBasemap: "osm" | "humanitarian") => {
    if (!mapRef.current) return

    // Remove current basemap
    mapRef.current.removeLayer(basemaps[currentBasemap])

    // Add new basemap
    mapRef.current.addLayer(basemaps[newBasemap])

    setCurrentBasemap(newBasemap)
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
          visiblePoints={currentZoom >= 15 ? surveyPoints.length : 0}
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

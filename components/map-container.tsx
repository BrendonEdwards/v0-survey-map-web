"use client"

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react"
import L from "leaflet"
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

const sanitizeCssClass = (str: string): string => str.replace(/[^a-zA-Z0-9_-]/g, "_")

type MapContainerProps = {
  onMapStateChange?: (state: { zoom: number; lat: number; lng: number }) => void
  initialState?: { zoom: number; lat: number; lng: number }
}

export interface MapContainerRef {
  searchAndFlyTo: (cellId: string) => Promise<boolean>
  getSuggestions: (query: string) => string[]
}

/** helpers to load external assets once */
const loadScriptOnce = (src: string, integrity?: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement("script")
    s.src = src
    if (integrity) {
      s.integrity = integrity
      s.crossOrigin = ""
      s.referrerPolicy = "no-referrer"
    }
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })

const loadCssOnce = (href: string) => {
  if (document.querySelector(`link[href="${href}"]`)) return
  const l = document.createElement("link")
  l.rel = "stylesheet"
  l.href = href
  document.head.appendChild(l)
}

const ZOOM_THRESHOLD = 8
const LABEL_ZOOM = 14

const MapContainer = forwardRef<MapContainerRef, MapContainerProps>(({ onMapStateChange, initialState }, ref) => {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const surveyLayerRef = useRef<any>(null)
  const canvasRendererRef = useRef<any>(null)

  const [surveyPoints, setSurveyPoints] = useState<SurveyPoint[]>([])
  const [currentZoom, setCurrentZoom] = useState(10)
  const [showZoomToast, setShowZoomToast] = useState(false)
  const [currentBasemap, setCurrentBasemap] = useState<"osm" | "humanitarian">("osm")
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [clusterReady, setClusterReady] = useState(false)

  /** load Leaflet core */
  useEffect(() => {
    const loadLeaflet = async () => {
      if (typeof window !== "undefined" && !window.L) {
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        script.crossOrigin = ""
        script.onload = () => {
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

  /** load markercluster plugin and css after Leaflet is present */
  useEffect(() => {
    if (!leafletLoaded) return
    loadCssOnce("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css")
    loadCssOnce("https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css")
    loadScriptOnce("https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js")
      .then(() => setClusterReady(true))
      .catch((e) => {
        console.warn("[v0] markercluster failed to load, falling back to simple layer", e)
        setClusterReady(false)
      })
  }, [leafletLoaded])

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
        mapRef.current.flyTo([point.lat, point.lng], 16, { duration: 1.2 })
        setTimeout(() => {
          const highlight = window.L.circleMarker([point.lat, point.lng], {
            radius: 12,
            fillColor: "#fbbf24",
            color: "#f59e0b",
            weight: 3,
            opacity: 1,
            fillOpacity: 0.6,
            renderer: canvasRendererRef.current || undefined,
          })
          highlight.addTo(mapRef.current)
          setTimeout(() => {
            if (mapRef.current && mapRef.current.hasLayer(highlight)) {
              mapRef.current.removeLayer(highlight)
            }
          }, 1800)
        }, 1200)
        return true
      }
      return false
    },
    getSuggestions: (query: string): string[] => {
      if (!query.trim()) return []
      const lower = query.toLowerCase()
      return surveyPoints.filter((p) => p.cell_id.toLowerCase().includes(lower)).map((p) => p.cell_id).sort()
    },
  }))

  const loadGeoJSONData = async (): Promise<SurveyPoint[]> => {
    const response = await fetch(`/centroid.geojson?v=${Date.now()}`, { cache: "no-store" })
    if (!response.ok) throw new Error(`Failed to load GeoJSON: ${response.status} ${response.statusText}`)
    const text = await response.text()
    if (text.trim().startsWith("<")) throw new Error("Received HTML instead of JSON")
    const gj = JSON.parse(text)
    if (!Array.isArray(gj?.features)) throw new Error("Invalid GeoJSON format")
    const points: SurveyPoint[] = []
    gj.features.forEach((f: any, i: number) => {
      if (f?.geometry?.type !== "Point") return
      const [lng, lat] = f.geometry.coordinates || []
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const cell = f.properties?.cell_id ?? f.properties?.name ?? `Point_${i}`
        points.push({ id: `point_${i}`, lat, lng, cell_id: cell })
      }
    })
    return points
  }

  /** build the survey layer, clustered if plugin loaded */
  const createSurveyPointsLayer = (points: SurveyPoint[]) => {
    if (!window.L) return null
    const canvas = canvasRendererRef.current || window.L.canvas()
    canvasRendererRef.current = canvas

    const cluster =
      (window.L as any).markerClusterGroup
        ? (window.L as any).markerClusterGroup({
            maxClusterRadius: 60,
            spiderfyOnEveryZoom: false,
            showCoverageOnHover: false,
          })
        : window.L.layerGroup()

    points.forEach((p) => {
      const m = window.L.circleMarker([p.lat, p.lng], {
        renderer: canvas,
        radius: 4,
        weight: 1,
        color: "#dc2626",
        fillColor: "#dc2626",
        fillOpacity: 0.9,
      })
      // add tooltip only when zoomed in, to avoid thousands of DOM nodes
      m.on("add", () => {
        const z = mapRef.current?.getZoom?.() ?? 0
        if (z >= LABEL_ZOOM && !m.getTooltip()) {
          m.bindTooltip(p.cell_id, { permanent: false, direction: "top", opacity: 0.9 })
        }
      })
      ;(cluster as any).addLayer(m)
    })

    return cluster
  }

  // Initialise map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !leafletLoaded || !window.L) return
    try {
      const map = window.L.map(mapContainerRef.current, {
        center: initialState ? [initialState.lat, initialState.lng] : [24.7136, 46.6753], // Riyadh
        zoom: initialState?.zoom || 11,
        zoomControl: false,
        preferCanvas: true,
      })

      canvasRendererRef.current = window.L.canvas()
      window.L.control.zoom({ position: "bottomright" }).addTo(map)

      const basemaps = createBasemaps()
      basemaps[currentBasemap].addTo(map)

      const safe = (fn: () => void) => () => {
        try {
          fn()
        } catch (e) {
          console.warn("[v0] Map handler error", e)
        }
      }

      const updateMapState = safe(() => {
        const c = map.getCenter()
        onMapStateChange?.({ zoom: map.getZoom(), lat: c.lat, lng: c.lng })
      })

      map.on("moveend", updateMapState)
      map.on(
        "zoomend",
        safe(() => {
          const z = map.getZoom()
          setCurrentZoom(z)
          const layer = surveyLayerRef.current
          if (!layer) return
          if (z >= ZOOM_THRESHOLD) {
            if (!map.hasLayer(layer)) map.addLayer(layer)
            setShowZoomToast(false)
          } else {
            if (map.hasLayer(layer)) map.removeLayer(layer)
            setShowZoomToast(true)
          }
        }),
      )

      // restore from hash if present
      if (!initialState) {
        try {
          const hash = window.location.hash.substring(1)
          if (hash) {
            let zoom, lat, lng
            if (hash.includes("/")) {
              const parts = hash.split("/")
              if (parts.length === 3) [zoom, lat, lng] = parts.map(Number)
            } else if (hash.startsWith("map_")) {
              const parts = hash.substring(4).split("_")
              if (parts.length === 3) {
                zoom = Number(parts[0])
                lat = Number(parts[1]) / 100000
                lng = Number(parts[2]) / 100000
              }
            }
            if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
              map.setView([lat, lng], zoom)
            }
          }
        } catch (e) {
          console.error("Hash parse error", e)
        }
      }

      mapRef.current = map

      return () => {
        try {
          map.remove()
          mapRef.current = null
        } catch (e) {
          console.warn("[v0] Map cleanup error", e)
        }
      }
    } catch (e) {
      console.error("[v0] Map init error", e)
      setLoadError("Failed to initialise map")
    }
  }, [leafletLoaded, initialState, onMapStateChange])

  /** load data and build layer when ready */
  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true)
        setLoadError(null)

        const points = await loadGeoJSONData()
        setSurveyPoints(points)

        if (mapRef.current && window.L) {
          const layer = createSurveyPointsLayer(points)
          if (layer) {
            surveyLayerRef.current = layer
            const z = mapRef.current.getZoom()
            if (z >= ZOOM_THRESHOLD) mapRef.current.addLayer(layer)

            // fit to data once
            try {
              const bounds = window.L.latLngBounds(points.map((p) => [p.lat, p.lng]) as any)
              if (bounds.isValid()) mapRef.current.fitBounds(bounds.pad(0.2))
            } catch {}
          }
        }
      } catch (e) {
        console.error("[v0] Data load error", e)
        setLoadError("Failed to load survey data")
      } finally {
        setIsLoading(false)
      }
    }

    if (mapRef.current && leafletLoaded) run()
  }, [mapRef.current, leafletLoaded, clusterReady])

  // Switch basemap
  const switchBasemap = (newBasemap: "osm" | "humanitarian") => {
    if (!mapRef.current || !window.L) return
    const basemaps = createBasemaps()
    mapRef.current.removeLayer(basemaps[currentBasemap])
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
      <div ref={mapContainerRef} className="w-full h-full" />

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

      {loadError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000]">
          <ToastNotification message={loadError} type="error" duration={0} onClose={() => setLoadError(null)} />
        </div>
      )}

      {showZoomToast && !isLoading && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000]">
          <ToastNotification message="Zoom in to see survey points" type="info" duration={0} />
        </div>
      )}

      <div className="hidden lg:block absolute bottom-4 left-4 z-[1000]">
        <MapStats
          totalPoints={surveyPoints.length}
          visiblePoints={currentZoom >= ZOOM_THRESHOLD ? surveyPoints.length : 0}
          currentZoom={currentZoom}
          isLoading={isLoading}
        />
      </div>

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
              className="text-xs h-7 px-2"
            >
              Standard
            </Button>
            <Button
              size="sm"
              variant={currentBasemap === "humanitarian" ? "default" : "ghost"}
              onClick={() => switchBasemap("humanitarian")}
              className="text-xs h-7 px-2"
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

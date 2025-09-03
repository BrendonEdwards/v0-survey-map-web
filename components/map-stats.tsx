"use client"

import { Card } from "@/components/ui/card"
import { MapPin, Layers, Zap } from "lucide-react"

interface MapStatsProps {
  totalPoints: number
  visiblePoints: number
  currentZoom: number
  isLoading: boolean
}

export function MapStats({ totalPoints, visiblePoints, currentZoom, isLoading }: MapStatsProps) {
  return (
    <Card className="p-3 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3 h-3" />
          <span className="font-medium">Map Stats</span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-primary" />
              <span>Total Points</span>
            </div>
            <span className="font-medium text-foreground">{isLoading ? "..." : totalPoints.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-600" />
              <span>Visible</span>
            </div>
            <span className="font-medium text-foreground">
              {currentZoom >= 15 ? visiblePoints.toLocaleString() : "0"}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-muted-foreground" />
              <span>Zoom Level</span>
            </div>
            <span className="font-medium text-foreground">{currentZoom}</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

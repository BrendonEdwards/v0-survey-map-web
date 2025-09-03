"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Map, Menu, X } from "lucide-react"
import { SearchBox } from "./search-box"
import { ShareButton } from "./share-button"

interface MobileHeaderProps {
  onSearch: (query: string) => Promise<boolean>
  getSuggestions: (query: string) => string[]
  isSearching: boolean
  onClearSearch?: () => void
  onGetShareUrl?: () => string
}

export function MobileHeader({
  onSearch,
  getSuggestions,
  isSearching,
  onClearSearch,
  onGetShareUrl,
}: MobileHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile Header */}
      <header className="md:hidden absolute top-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Survey Map</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Share Button */}
            {onGetShareUrl && <ShareButton onGetShareUrl={onGetShareUrl} />}

            <Button variant="ghost" size="sm" onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2">
              {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Search Panel */}
        {isMenuOpen && (
          <div className="border-t border-border bg-background/95 backdrop-blur-md p-4 animate-in slide-in-from-top-2 duration-200">
            <SearchBox
              onSearch={onSearch}
              getSuggestions={getSuggestions}
              isSearching={isSearching}
              onClear={onClearSearch}
              className="w-full"
            />
          </div>
        )}
      </header>

      {/* Desktop Header */}
      <header className="hidden md:flex absolute top-0 left-0 right-0 z-[1000] bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 py-3 w-full">
          <div className="flex items-center gap-2">
            <Map className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Survey Map</h1>
          </div>

          <SearchBox
            onSearch={onSearch}
            getSuggestions={getSuggestions}
            isSearching={isSearching}
            onClear={onClearSearch}
          />
        </div>
      </header>
    </>
  )
}

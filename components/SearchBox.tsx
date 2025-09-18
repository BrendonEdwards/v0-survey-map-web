import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type PlaceResult = { name: string; lat: number; lon: number; bbox?: [number, number, number, number] };
type Props = { onPick: (r: PlaceResult) => void; className?: string };

export default function SearchBox({ onPick, className }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q) {
      setResults([]);
      setActiveIndex(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data: PlaceResult[] = await res.json();
        setResults(data);
        setOpen(true);
        setActiveIndex(null);
      } catch {
        setResults([]);
        setActiveIndex(null);
      }
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className={cn("relative w-64", className)}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a city or neighbourhood"
        className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        onFocus={() => q && setOpen(true)}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            setActiveIndex(null);
          }, 150)
        }
        aria-label="Search places"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActiveIndex((i) => {
              const n = results.length;
              if (!n) return null;
              return i === null ? 0 : Math.min(i + 1, n - 1);
            });
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => {
              const n = results.length;
              if (!n) return null;
              return i === null ? n - 1 : Math.max(i - 1, 0);
            });
          } else if (e.key === "Enter") {
            e.preventDefault();
            const pick = activeIndex !== null ? results[activeIndex] : results[0];
            if (pick) {
              setQ(pick.name);
              setOpen(false);
              setActiveIndex(null);
              onPick(pick);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
            setActiveIndex(null);
          }
        }}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-popover text-popover-foreground shadow">
          {results.map((r, i) => (
            <li
              key={`${r.lat}-${r.lon}-${i}`}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                activeIndex === i
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
              onMouseDown={() => {
                setOpen(false);
                setQ(r.name);
                setActiveIndex(null);
                onPick(r);
              }}
            >
              {r.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

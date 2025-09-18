import { useEffect, useRef, useState } from "react";

type Result = { name: string; lat: number; lon: number; bbox?: [number, number, number, number] };
type Props = { onPick: (r: Result) => void };

export default function SearchBox({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
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
        const data: Result[] = await res.json();
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
    <div className="relative w-full max-w-md">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search a city or neighbourhood"
        className="w-full rounded-xl border px-4 py-2 shadow-sm"
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
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-white shadow">
          {results.map((r, i) => (
            <li
              key={`${r.lat}-${r.lon}-${i}`}
              className={`cursor-pointer px-3 py-2 ${
                activeIndex === i ? "bg-gray-100" : "hover:bg-gray-100"
              }`}
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

import { useEffect, useRef, useState } from "react";

type Result = { name: string; lat: number; lon: number; bbox?: [number, number, number, number] };
type Props = { onPick: (r: Result) => void };

export default function SearchBox({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q) {
      setResults([]);
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
      } catch {
        setResults([]);
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
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Search places"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-white shadow">
          {results.map((r, i) => (
            <li
              key={`${r.lat}-${r.lon}-${i}`}
              className="cursor-pointer px-3 py-2 hover:bg-gray-100"
              onMouseDown={() => {
                setOpen(false);
                setQ(r.name);
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

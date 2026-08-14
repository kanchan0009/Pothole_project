import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { FaMapMarkerAlt, FaSearch, FaSpinner, FaTimes } from 'react-icons/fa';
import {
  KATHMANDU_PLACES,
  mergePlaces,
  searchLocalPlaces,
  searchRemotePlaces,
  toSuggestion,
  type PlaceSuggestion,
} from '../../lib/mapPlaces';

interface SearchBarProps {
  onSelect: (place: PlaceSuggestion) => void;
}

const POPULAR = KATHMANDU_PLACES.slice(0, 6);


const REMOTE_DEBOUNCE_MS = 350;


export function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  
  useEffect(() => {
    const q = query.trim();
    if (!open) return;

    
    const local = searchLocalPlaces(q);
    setSuggestions(local);
    setActive(0);

    if (q.length < 2) {
      setLoading(false);
      return;
    }

    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => {
      void searchRemotePlaces(q, controller.signal).then((remote) => {
        if (controller.signal.aborted) return;
        setSuggestions(mergePlaces(local, remote));
        setLoading(false);
      });
    }, REMOTE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const shown = suggestions.length > 0;
  const placeholder = 'Search a location… e.g. Kathmandu, Patan';

  function choose(place: PlaceSuggestion) {
    setQuery(place.label);
    setOpen(false);
    onSelect(place);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true); 
        setSuggestions(
          query.trim()
            ? searchLocalPlaces(query)
            : POPULAR.map(toSuggestion)
        );
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setActive((a) => (a + 1) % suggestions.length);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setActive((a) => (a - 1 + suggestions.length) % suggestions.length);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const pick = suggestions[active];
      if (pick) choose(pick);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative z-40 w-[min(92%,420px)]">
      <div className="flex items-center gap-2 rounded-full border border-white/60 bg-white/90 px-4 py-2.5 shadow-card-hover backdrop-blur-md">
        <FaSearch className="shrink-0 text-primary/40" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-primary outline-none placeholder:text-primary/40"
        />
        {loading && <FaSpinner className="animate-spin text-accent" />}
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setOpen(false);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="text-primary/40 transition hover:text-primary"
          >
            <FaTimes />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && shown && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-full mt-2 max-h-80 overflow-y-auto rounded-xl border border-white/60 bg-white/95 py-1.5 shadow-card-hover backdrop-blur-md"
          >
            {suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(s)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                    i === active ? 'bg-accent/10' : ''
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/5 text-accent">
                    <FaMapMarkerAlt />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-primary">{s.label}</span>
                    <span className="block truncate text-xs text-primary/50">{s.sublabel}</span>
                  </span>
                  {s.source === 'nominatim' && (
                    <span className="ml-auto shrink-0 rounded bg-primary/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary/40">
                      OSM
                    </span>
                  )}
                </button>
              </li>
            ))}
            {loading && suggestions.length === 0 && (
              <li className="flex items-center gap-2 px-4 py-3 text-sm text-primary/50">
                <FaSpinner className="animate-spin text-accent" /> Searching…
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  ALL_COUNTRIES,
  joinCountryCodes,
  parseCountryCodesString,
  getCountryName,
  getCountryFlag,
} from '@/lib/allCountries';

/**
 * Multi-select for ISO country codes.
 * @param {string} value - Comma-separated codes, e.g. "BE,FR,CD"
 * @param {(value: string) => void} onChange
 * @param {Array<{code:string,name:string,flag:string}>} [countries] - Pool to pick from (defaults to all)
 */
export default function CountryMultiSelect({
  value = '',
  onChange,
  placeholder = 'Select countries…',
  className,
  disabled = false,
  countries = ALL_COUNTRIES,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const countryList = countries.length ? countries : ALL_COUNTRIES;
  const allowedCodes = useMemo(() => new Set(countryList.map((c) => c.code)), [countryList]);

  const selected = useMemo(() => {
    return parseCountryCodesString(value).filter((code) => allowedCodes.has(code));
  }, [value, allowedCodes]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return countryList;
    return countryList.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q)
    );
  }, [search, countryList]);

  function setSelected(codes) {
    onChange?.(joinCountryCodes(codes.filter((code) => allowedCodes.has(code))));
  }

  function toggle(code) {
    if (!allowedCodes.has(code)) return;
    const next = new Set(selectedSet);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelected([...next]);
  }

  function clearAll() {
    onChange?.('');
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal bg-secondary border-border text-left h-auto min-h-10 py-2 gap-2',
              !selected.length && 'text-muted-foreground'
            )}
          >
            {selected.length === 0 ? (
              <span className="truncate text-sm">{placeholder}</span>
            ) : selected.length <= 6 ? (
              <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                {selected.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded bg-background/60 border border-border/60 px-1.5 py-0.5 text-xs"
                  >
                    <span className="text-base leading-none" aria-hidden>
                      {getCountryFlag(code)}
                    </span>
                    <span className="font-mono text-[10px]">{code}</span>
                  </span>
                ))}
              </span>
            ) : (
              <span className="flex items-center gap-2 truncate text-sm">
                <span className="flex -space-x-1">
                  {selected.slice(0, 5).map((code) => (
                    <span
                      key={code}
                      className="text-base leading-none bg-secondary rounded-full ring-1 ring-border px-0.5"
                      title={getCountryName(code)}
                    >
                      {getCountryFlag(code)}
                    </span>
                  ))}
                </span>
                <span>{selected.length} countries selected</span>
              </span>
            )}
            <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
          <div className="p-2 border-b border-border space-y-2">
            <Input
              placeholder="Search country or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 bg-secondary border-border text-sm"
            />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{selected.length} selected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => setSelected(countryList.map((c) => c.code))}
                >
                  All
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:underline"
                  onClick={clearAll}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <ScrollArea className="h-64">
            <ul className="p-1">
              {filtered.map((country) => {
                const checked = selectedSet.has(country.code);
                return (
                  <li key={country.code}>
                    <button
                      type="button"
                      className={cn(
                        'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent text-left',
                        checked && 'bg-accent/60'
                      )}
                      onClick={() => toggle(country.code)}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="text-lg leading-none w-6 shrink-0 text-center" aria-hidden>
                        {country.flag}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">
                        {country.code}
                      </span>
                      <span className="truncate text-foreground">{country.name}</span>
                    </button>
                  </li>
                );
              })}
              {!filtered.length && (
                <li className="px-2 py-6 text-center text-sm text-muted-foreground">No matches</li>
              )}
            </ul>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <div className="relative">
        {selected.length > 0 && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 flex gap-0.5 pointer-events-none">
            {selected.slice(0, 8).map((code) => (
              <span key={code} className="text-sm leading-none" title={getCountryName(code)}>
                {getCountryFlag(code)}
              </span>
            ))}
            {selected.length > 8 && (
              <span className="text-[10px] text-muted-foreground self-center">+{selected.length - 8}</span>
            )}
          </span>
        )}
        <Input
          readOnly
          value={joinCountryCodes(selected)}
          placeholder="BE,FR,CD"
          className={cn(
            'bg-secondary border-border text-sm font-mono',
            selected.length > 0 && 'pl-[calc(0.75rem+var(--flag-pad,0px))]'
          )}
          style={
            selected.length > 0
              ? { paddingLeft: `${Math.min(selected.length, 8) * 1.35 + 2}rem` }
              : undefined
          }
          title={selected.map((code) => `${getCountryFlag(code)} ${code} — ${getCountryName(code)}`).join('\n')}
        />
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-md bg-secondary border border-border px-1.5 py-0.5 text-[10px] font-mono"
            >
              <span className="text-sm leading-none" aria-hidden>{getCountryFlag(code)}</span>
              {code}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${code}`}
                onClick={() => toggle(code)}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

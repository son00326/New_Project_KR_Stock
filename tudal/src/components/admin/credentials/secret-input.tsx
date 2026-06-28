"use client";

import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// DQ-7 Session 2 T11 · spec §5.3·§5.7.
// Shared secret input: type=password toggle, autocomplete=new-password,
// length counter, and DOM-value cleanup on unmount.

interface SecretInputProps {
  id: string;
  name: string;
  value: string;
  onValueChange: (next: string) => void;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
}

export function SecretInput({
  id,
  name,
  value,
  onValueChange,
  maxLength,
  placeholder,
  required,
  ariaLabel,
}: SecretInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = inputRef.current;
    return () => {
      // Hygiene (§5.7): clear DOM value on unmount — belt-and-suspenders
      // beyond React's controlled-value reconciliation.
      if (el) el.value = "";
    };
  }, []);

  const showCounter = maxLength != null;
  const counterState =
    value.length === 0
      ? "neutral"
      : value.length === maxLength
        ? "ok"
        : "error";

  return (
    <div className="space-y-1">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={revealed ? "text" : "password"}
          autoComplete="new-password"
          spellCheck={false}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          aria-label={ariaLabel}
          maxLength={maxLength}
          className="w-full rounded-xl border bg-background px-3 py-2.5 pr-10 font-mono text-sm outline-none ring-1 ring-transparent transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-ring/50"
        />
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={revealed ? "시크릿 숨기기" : "시크릿 표시"}
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      {showCounter && (
        <p
          className={`text-right font-mono text-xs tabular-nums ${
            counterState === "neutral"
              ? "text-muted-foreground"
              : counterState === "ok"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400"
          }`}
          aria-live="polite"
        >
          {value.length} / {maxLength}
        </p>
      )}
    </div>
  );
}

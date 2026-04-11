"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, TrendingUp, Clock, X, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchStocks, MOCK_STOCKS } from "@/lib/data/mock-stocks";
import { formatKRW, formatPercent } from "@/lib/constants";
import type { Stock } from "@/types/stock";

const RECENT_SEARCH_KEY = "joopick_recent_searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCH_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(ticker: string) {
  const recent = getRecentSearches().filter((t) => t !== ticker);
  recent.unshift(ticker);
  localStorage.setItem(
    RECENT_SEARCH_KEY,
    JSON.stringify(recent.slice(0, MAX_RECENT))
  );
}

function clearRecentSearches() {
  localStorage.removeItem(RECENT_SEARCH_KEY);
}

// 인기 종목 (mock)
const POPULAR_STOCKS = MOCK_STOCKS.slice(0, 5);

interface StockSearchProps {
  variant?: "header" | "hero";
  placeholder?: string;
  autoFocus?: boolean;
}

export function StockSearch({
  variant = "header",
  placeholder = "종목명 또는 종목코드 검색",
  autoFocus = false,
}: StockSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 검색 결과 업데이트
  useEffect(() => {
    if (query.trim()) {
      setResults(searchStocks(query));
      setSelectedIndex(-1);
    } else {
      setResults([]);
    }
  }, [query]);

  // 최근 검색 로드
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, [isOpen]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateToStock = useCallback(
    (ticker: string) => {
      addRecentSearch(ticker);
      setQuery("");
      setIsOpen(false);
      router.push(`/stock/${ticker}`);
    },
    [router]
  );

  // 키보드 네비게이션
  function handleKeyDown(e: React.KeyboardEvent) {
    const items = query.trim() ? results : [];
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && items[selectedIndex]) {
      e.preventDefault();
      navigateToStock(items[selectedIndex].ticker);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  function handleClearRecent() {
    clearRecentSearches();
    setRecentSearches([]);
  }

  const recentStocks = recentSearches
    .map((ticker) => MOCK_STOCKS.find((s) => s.ticker === ticker))
    .filter(Boolean) as Stock[];

  const isHero = variant === "hero";

  return (
    <div ref={containerRef} className="relative w-full">
      {/* 검색 입력 */}
      <div className="relative">
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${
            isHero ? "h-5 w-5" : "h-4 w-4"
          }`}
        />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          className={`${isHero ? "h-14 pl-12 text-base" : "h-10 pl-10"} bg-muted/50`}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className={isHero ? "h-5 w-5" : "h-4 w-4"} />
          </button>
        )}
      </div>

      {/* 드롭다운 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 overflow-hidden max-h-[400px] overflow-y-auto">
          {/* 검색 결과 */}
          {query.trim() ? (
            results.length > 0 ? (
              <div>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                  검색 결과 ({results.length})
                </div>
                {results.map((stock, index) => (
                  <StockItem
                    key={stock.ticker}
                    stock={stock}
                    isSelected={index === selectedIndex}
                    onClick={() => navigateToStock(stock.ticker)}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                &quot;{query}&quot;에 대한 검색 결과가 없습니다
              </div>
            )
          ) : (
            <>
              {/* 최근 검색 */}
              {recentStocks.length > 0 && (
                <div>
                  <div className="px-4 py-2 flex items-center justify-between bg-muted/30">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      최근 검색
                    </span>
                    <button
                      onClick={handleClearRecent}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      전체 삭제
                    </button>
                  </div>
                  {recentStocks.map((stock) => (
                    <StockItem
                      key={stock.ticker}
                      stock={stock}
                      isSelected={false}
                      onClick={() => navigateToStock(stock.ticker)}
                    />
                  ))}
                </div>
              )}

              {/* 인기 종목 */}
              <div>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  인기 종목
                </div>
                {POPULAR_STOCKS.map((stock) => (
                  <StockItem
                    key={stock.ticker}
                    stock={stock}
                    isSelected={false}
                    onClick={() => navigateToStock(stock.ticker)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StockItem({
  stock,
  isSelected,
  onClick,
}: {
  stock: Stock;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isPositive = stock.changePercent > 0;
  const isNegative = stock.changePercent < 0;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left ${
        isSelected ? "bg-muted/50" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{stock.name}</span>
            <Badge variant="secondary" className="text-xs shrink-0">
              {stock.market}
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{stock.ticker}</span>
            <span className="text-xs text-muted-foreground">|</span>
            <span className="text-xs text-muted-foreground">{stock.industry}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="text-right">
          <div className="text-sm font-medium">
            {stock.currentPrice.toLocaleString("ko-KR")}원
          </div>
          <div
            className={`text-xs font-medium ${
              isPositive
                ? "text-red-600"
                : isNegative
                ? "text-blue-600"
                : "text-muted-foreground"
            }`}
          >
            {formatPercent(stock.changePercent)}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </button>
  );
}

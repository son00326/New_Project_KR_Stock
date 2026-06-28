"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { EconomicEvent } from "@/types/macro";

interface EventCalendarProps {
  events: EconomicEvent[];
}

const COUNTRY_FLAG: Record<string, string> = {
  US: "🇺🇸",
  KR: "🇰🇷",
  EU: "🇪🇺",
  JP: "🇯🇵",
  CN: "🇨🇳",
};

const IMPORTANCE_STYLE = {
  high: "bg-destructive/10 text-destructive border-0",
  medium: "bg-chart-5/10 text-chart-5 border-0",
  low: "bg-muted text-muted-foreground border-0",
};

const IMPORTANCE_LABEL = {
  high: "중요",
  medium: "보통",
  low: "참고",
};

export function EventCalendar({ events }: EventCalendarProps) {
  // 날짜별 그룹핑
  const grouped = events.reduce<Record<string, EconomicEvent[]>>((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + "T00:00:00");
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
    const today = new Date().toISOString().slice(0, 10);
    const isToday = dateStr === today;
    return { label: `${month}/${day} (${dayOfWeek})`, isToday };
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const { label, isToday } = formatDate(date);
            const dayEvents = grouped[date];

            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                    {label}
                  </span>
                  {isToday && (
                    <Badge variant="default" className="text-xs">
                      오늘
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 pl-4 border-l-2 border-muted">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2"
                    >
                      {/* 시간 */}
                      <span className="text-xs text-muted-foreground font-mono tabular-nums w-12 shrink-0">
                        {event.time}
                      </span>

                      {/* 국가 + 이벤트명 */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-base">{COUNTRY_FLAG[event.country]}</span>
                        <span className="text-sm font-medium truncate">
                          {event.nameKo}
                        </span>
                        <Badge className={`text-xs shrink-0 ${IMPORTANCE_STYLE[event.importance]}`}>
                          {IMPORTANCE_LABEL[event.importance]}
                        </Badge>
                      </div>

                      {/* 전/예상/실제 */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums shrink-0">
                        {event.previous && (
                          <span>
                            이전: <span className="font-medium text-foreground">{event.previous}</span>
                          </span>
                        )}
                        {event.forecast && (
                          <span>
                            예상: <span className="font-medium text-foreground">{event.forecast}</span>
                          </span>
                        )}
                        {event.actual && (
                          <span>
                            실제: <span className="font-semibold text-primary">{event.actual}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

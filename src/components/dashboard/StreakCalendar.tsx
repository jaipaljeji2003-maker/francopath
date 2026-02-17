"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DayData {
  date: string;
  cards_reviewed: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function StreakCalendar({ userId }: { userId: string }) {
  const [days, setDays] = useState<DayData[]>([]);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [hoveredDay, setHoveredDay] = useState<DayData | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadActivity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadActivity = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 28); // 4 weeks

    const { data } = await supabase
      .from("daily_activity")
      .select("activity_date, cards_reviewed")
      .eq("user_id", userId)
      .gte("activity_date", since.toISOString().split("T")[0])
      .order("activity_date", { ascending: true });

    setDays((data || []).map(d => ({ date: d.activity_date, cards_reviewed: d.cards_reviewed })));

    const { data: profile } = await supabase
      .from("profiles")
      .select("current_streak, longest_streak")
      .eq("id", userId)
      .single();

    setStreak(profile?.current_streak || 0);
    setLongestStreak(profile?.longest_streak || 0);
  };

  // Build proper week grid (4 weeks, Mon-Sun columns)
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // Find the Monday 4 weeks ago
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 27);
  // Adjust to Monday
  const dayOfWeek = startDate.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startDate.setDate(startDate.getDate() + diff);

  // Build 4 weeks × 7 days grid
  const weeks: Array<Array<{ date: string; cards: number; isToday: boolean; isFuture: boolean }>> = [];
  const current = new Date(startDate);

  for (let w = 0; w < 4; w++) {
    const week: typeof weeks[0] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split("T")[0];
      const dayData = days.find(dd => dd.date === dateStr);
      week.push({
        date: dateStr,
        cards: dayData?.cards_reviewed || 0,
        isToday: dateStr === todayStr,
        isFuture: current > today,
      });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  const getColor = (cards: number, isFuture: boolean) => {
    if (isFuture) return "bg-brand-border/30";
    if (cards === 0) return "bg-brand-border";
    if (cards < 5) return "bg-brand-accent/30";
    if (cards < 15) return "bg-brand-accent/60";
    return "bg-brand-accent";
  };

  // Get month label for display
  const monthName = today.toLocaleString("default", { month: "long" });

  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-accent/10 flex items-center justify-center text-2xl">
            🔥
          </div>
          <div>
            <div className="text-2xl font-black text-brand-accent leading-tight">{streak} day streak</div>
            <div className="text-[10px] text-brand-dim">Best: {longestStreak} days</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-brand-dim font-medium">{monthName}</div>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-[9px] text-brand-dim text-center font-medium">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="space-y-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map(day => (
              <div
                key={day.date}
                onMouseEnter={() => !day.isFuture && setHoveredDay({ date: day.date, cards_reviewed: day.cards })}
                onMouseLeave={() => setHoveredDay(null)}
                className={`aspect-square rounded-lg transition-all ${getColor(day.cards, day.isFuture)} ${
                  day.isToday ? "ring-2 ring-brand-accent ring-offset-1 ring-offset-brand-surface" : ""
                } ${!day.isFuture && day.cards > 0 ? "hover:scale-110 cursor-pointer" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredDay && (
        <div className="mt-3 text-center text-xs text-brand-muted animate-fade-up">
          <span className="font-semibold">{new Date(hoveredDay.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
          {" · "}
          {hoveredDay.cards_reviewed > 0 ? `${hoveredDay.cards_reviewed} cards reviewed` : "No activity"}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-brand-border">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-brand-dim">Less</span>
          {["bg-brand-border", "bg-brand-accent/30", "bg-brand-accent/60", "bg-brand-accent"].map((c, i) => (
            <div key={i} className={`w-3 h-3 rounded ${c}`} />
          ))}
          <span className="text-[9px] text-brand-dim">More</span>
        </div>
        <span className="text-[9px] text-brand-dim">Last 4 weeks</span>
      </div>
    </div>
  );
}

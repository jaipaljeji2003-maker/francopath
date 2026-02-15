"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface DayData {
  date: string;
  cards_reviewed: number;
}

export default function StreakCalendar({ userId }: { userId: string }) {
  const [days, setDays] = useState<DayData[]>([]);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    loadActivity();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadActivity = async () => {
    // Last 35 days of activity
    const since = new Date();
    since.setDate(since.getDate() - 35);

    const { data } = await supabase
      .from("daily_activity")
      .select("activity_date, cards_reviewed")
      .eq("user_id", userId)
      .gte("activity_date", since.toISOString().split("T")[0])
      .order("activity_date", { ascending: true });

    setDays(
      (data || []).map((d) => ({
        date: d.activity_date,
        cards_reviewed: d.cards_reviewed,
      }))
    );

    // Calculate streak
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_streak, longest_streak")
      .eq("id", userId)
      .single();

    setStreak(profile?.current_streak || 0);
    setLongestStreak(profile?.longest_streak || 0);
  };

  // Build 5 weeks grid (Mon-Sun rows)
  const today = new Date();
  const grid: Array<{ date: string; active: boolean; intensity: number }> = [];

  for (let i = 34; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const dayData = days.find((dd) => dd.date === dateStr);
    const cards = dayData?.cards_reviewed || 0;

    grid.push({
      date: dateStr,
      active: cards > 0,
      intensity: cards === 0 ? 0 : cards < 5 ? 1 : cards < 15 ? 2 : 3,
    });
  }

  const intensityColors = [
    "bg-brand-border",
    "bg-brand-accent/30",
    "bg-brand-accent/60",
    "bg-brand-accent",
  ];

  return (
    <div className="bg-brand-surface border border-brand-border rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <div>
            <div className="text-2xl font-black text-brand-accent">{streak}</div>
            <div className="text-[10px] text-brand-dim">day streak</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-brand-muted">{longestStreak}</div>
          <div className="text-[10px] text-brand-dim">best streak</div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex gap-[3px] flex-wrap">
        {grid.map((day) => (
          <div
            key={day.date}
            title={`${day.date}: ${day.active ? "studied" : "no activity"}`}
            className={`w-[12px] h-[12px] rounded-[3px] transition-all ${intensityColors[day.intensity]} ${
              day.date === today.toISOString().split("T")[0]
                ? "ring-1 ring-brand-accent ring-offset-1 ring-offset-brand-surface"
                : ""
            }`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-3">
        <span className="text-[9px] text-brand-dim mr-1">Less</span>
        {intensityColors.map((c, i) => (
          <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />
        ))}
        <span className="text-[9px] text-brand-dim ml-1">More</span>
      </div>
    </div>
  );
}

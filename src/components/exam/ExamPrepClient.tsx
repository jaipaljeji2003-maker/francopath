"use client";

import { useState } from "react";
import Link from "next/link";
import type { Profile } from "@/types";
import WritingPractice from "./WritingPractice";

interface Props {
  profile: Profile;
}

export default function ExamPrepClient({ profile }: Props) {
  const exam = profile.target_exam || "TCF";

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-brand-dim hover:text-brand-text text-xl">←</Link>
          <div>
            <h1 className="text-2xl font-extrabold">✍️ Writing Practice</h1>
            <p className="text-brand-dim text-xs">{exam} Canada · Expression écrite · {profile.current_level}</p>
          </div>
        </div>
        <WritingPractice examType={exam} level={profile.current_level} />
      </div>
    </div>
  );
}

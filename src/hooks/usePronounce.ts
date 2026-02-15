"use client";

import { useCallback } from "react";

/**
 * Hook for French text-to-speech using browser's built-in Speech Synthesis
 * Works on all modern browsers — no API key needed
 */
export function usePronounce() {
  const speak = useCallback((text: string, lang: string = "fr-FR") => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85; // Slightly slower for learners
    utterance.pitch = 1;

    // Try to find a French voice
    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find(
      (v) => v.lang.startsWith("fr") && v.localService
    ) || voices.find((v) => v.lang.startsWith("fr"));

    if (frenchVoice) {
      utterance.voice = frenchVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
}

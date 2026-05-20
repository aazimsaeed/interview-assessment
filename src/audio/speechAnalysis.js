// src/audio/speechAnalysis.js

const FILLER_WORDS = [
    "um", "uh", "ah", "like", "you know", "basically", "actually", "i think", "maybe",
    "sort of", "kind of", "probably", "i guess", "might", "sorry", "i apologize", "just wanted" 
];

export const createSpeechTracker = (onMetricUpdate) => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn("Speech Recognition API is not supported in this browser.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let totalWords = 0;
  let fillerCount = 0;
  let fullTranscript = ""; 
  let isStoppedManually = false; 
  
  // Soft Pause Flag. It starts paused so it doesn't transcribe ambient noise immediately.
  let isSoftPaused = true; 

  let cumulativeTimeMs = 0;
  let chunkStartTime = 0;

  recognition.onstart = () => {
    chunkStartTime = performance.now();
  };

  recognition.onresult = (event) => {
    // If soft-paused (like when the AI is talking), ignore the text completely
    if (isSoftPaused) return; 

    let currentFinal = '';
    let currentInterim = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        currentFinal += event.results[i][0].transcript;
      } else {
        currentInterim += event.results[i][0].transcript;
      }
    }

    if (currentFinal) {
      fullTranscript += currentFinal + " "; 
      
      const words = currentFinal.trim().split(/\s+/);
      totalWords += words.length;

      // --- ROBUST MULTI-WORD & CASE-INSENSITIVE DETECTION ---
      FILLER_WORDS.forEach(filler => {
        // Escape regex special characters just in case
        const escapedFiller = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Ensure we only match whole words (so "um" doesn't match "umbrella")
        const startBoundary = /^\w/.test(filler) ? '\\b' : '';
        const endBoundary = /\w$/.test(filler) ? '\\b' : '';
        
        // 'g' = global (checks entire sentence)
        // 'i' = case-insensitive (matches Um, UM, uM, um)
        const regex = new RegExp(`${startBoundary}${escapedFiller}${endBoundary}`, 'gi');
        
        const matches = currentFinal.match(regex);
        if (matches) {
          fillerCount += matches.length;
        }
      });
      // ----------------------------------------------------
    }

    const currentChunkTimeMs = performance.now() - chunkStartTime;
    const totalTimeMinutes = (cumulativeTimeMs + currentChunkTimeMs) / 60000;
    const wpm = totalTimeMinutes > 0 ? Math.round(totalWords / totalTimeMinutes) : 0;

    // Combine final text with live interim text so the candidate sees their words instantly
    const displayTranscript = (fullTranscript + currentInterim).trim();

    onMetricUpdate({ wpm, fillerCount, totalWords, fullTranscript: displayTranscript });
  };

  recognition.onerror = (event) => {
    if (event.error !== 'no-speech') {
        console.error("Speech recognition error:", event.error);
    }
  };

  recognition.onend = () => {
    // If the browser tries to sleep the mic, immediately restart it to keep it "warmed up"
    if (!isStoppedManually) {
      try { recognition.start(); } catch (error) {}
    }
  };

  // Turn it on IMMEDIATELY in the background when the interview starts
  try { recognition.start(); } catch (e) {}

  return {
    start: () => {
      isSoftPaused = false;
      chunkStartTime = performance.now(); 
    },
    stop: () => {
      isSoftPaused = true;
      if (chunkStartTime > 0) {
        cumulativeTimeMs += performance.now() - chunkStartTime;
        chunkStartTime = 0;
      }
    },
    turnOff: () => {
      isStoppedManually = true;
      try { recognition.stop(); } catch (e) {}
    },
    clearTranscript: () => {
      fullTranscript = "";
      const totalTimeMinutes = cumulativeTimeMs / 60000;
      const wpm = totalTimeMinutes > 0 ? Math.round(totalWords / totalTimeMinutes) : 0;
      onMetricUpdate({ wpm, fillerCount, totalWords, fullTranscript });
    }
  };
};
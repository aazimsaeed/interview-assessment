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
  
  // Start paused so it doesn't transcribe ambient noise or the AI's initial greeting
  let isSoftPaused = true; 

  let cumulativeTimeMs = 0;
  let chunkStartTime = 0;

  recognition.onstart = () => {
    if (!isSoftPaused) {
        chunkStartTime = performance.now();
    }
  };

  recognition.onresult = (event) => {
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

      FILLER_WORDS.forEach(filler => {
        const escapedFiller = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const startBoundary = /^\w/.test(filler) ? '\\b' : '';
        const endBoundary = /\w$/.test(filler) ? '\\b' : '';
        
        const regex = new RegExp(`${startBoundary}${escapedFiller}${endBoundary}`, 'gi');
        
        const matches = currentFinal.match(regex);
        if (matches) {
          fillerCount += matches.length;
        }
      });
    }

    const currentChunkTimeMs = performance.now() - chunkStartTime;
    const totalTimeMinutes = (cumulativeTimeMs + currentChunkTimeMs) / 60000;
    const wpm = totalTimeMinutes > 0 ? Math.round(totalWords / totalTimeMinutes) : 0;

    const displayTranscript = (fullTranscript + currentInterim).trim();

    onMetricUpdate({ wpm, fillerCount, totalWords, fullTranscript: displayTranscript });
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
        isStoppedManually = true;
    }
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error("Speech recognition error:", event.error);
    }
  };

  recognition.onend = () => {
    // Only auto-restart if the system is supposed to be actively listening to the user
    if (!isStoppedManually && !isSoftPaused) {
      setTimeout(() => {
          try { recognition.start(); } catch (error) {}
      }, 250);
    }
  };

  return {
    start: () => {
      // WAKE UP MIC: Called strictly after the AI finishes speaking
      isSoftPaused = false;
      chunkStartTime = performance.now(); 
      try { recognition.start(); } catch (e) {}
    },
    stop: () => {
      // HARD PAUSE: Instantly kills the microphone buffer so the AI's voice isn't caught
      isSoftPaused = true;
      try { recognition.abort(); } catch (e) {} 
      
      if (chunkStartTime > 0) {
        cumulativeTimeMs += performance.now() - chunkStartTime;
        chunkStartTime = 0;
      }
    },
    turnOff: () => {
      isStoppedManually = true;
      isSoftPaused = true;
      try { recognition.abort(); } catch (e) {}
    },
    clearTranscript: () => {
      fullTranscript = "";
      const totalTimeMinutes = cumulativeTimeMs / 60000;
      const wpm = totalTimeMinutes > 0 ? Math.round(totalWords / totalTimeMinutes) : 0;
      onMetricUpdate({ wpm, fillerCount, totalWords, fullTranscript });
    }
  };
};
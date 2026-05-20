// Keep state of blink timestamps outside the function to maintain history
let blinkHistory = [];
let isCurrentlyBlinking = false;

// Helper to safely extract blendshapes
const bs = (blendshapes, name) => {
  if (!blendshapes) return 0;
  let categories = blendshapes.categories || blendshapes[0]?.categories || blendshapes;
  const match = categories.find((c) => c.categoryName === name);
  return match ? match.score : 0;
};

export const detectBlinkRate = (blendshapes, currentTime = performance.now()) => {
  if (!blendshapes) return { blinksPerMinute: 0, isBlinking: false, stressLevel: "Normal" };

  // MediaPipe blendshapes for eye blinking
  const leftBlink = bs(blendshapes, "eyeBlinkLeft");
  const rightBlink = bs(blendshapes, "eyeBlinkRight");
  
  // Stricter threshold (lowered from 0.45 to 0.35) to capture flutters/partial nervous blinks
  const blinkThreshold = 0.35; 
  const isBlinking = leftBlink > blinkThreshold && rightBlink > blinkThreshold;

  // Debounce: Only count the blink once when the eyes close
  if (isBlinking && !isCurrentlyBlinking) {
    blinkHistory.push(currentTime);
  }
  isCurrentlyBlinking = isBlinking;

  // Clean up history array: strictly keep timestamps from the last 60 seconds (60,000 ms)
  blinkHistory = blinkHistory.filter(time => currentTime - time <= 60000);

  const blinksPerMinute = blinkHistory.length;
  
  // Evaluate Stress Level
  let stressLevel = "Normal";
  if (blinksPerMinute > 30) {
    stressLevel = "High (Rapid Blinking)"; // Indicates anxiety or panic
  } else if (blinksPerMinute < 8) {
    stressLevel = "Low (Staring)"; // Indicates heavy cognitive load or reading from a screen
  }

  return { 
    blinksPerMinute, 
    isBlinking, 
    stressLevel 
  };
};
// Keep track of where the hands were in the previous frame to calculate speed/movement
let previousHandCenters = [];

export const analyzeHandGestures = (handLandmarks) => {
  // If hands are under the desk / out of frame
  if (!handLandmarks || handLandmarks.length === 0) {
      previousHandCenters = [];
      return { isUsingHands: false, expressivenessScore: 0 };
  }

  // Find the geometric center (average X and Y) of each detected hand
  let currentCenters = handLandmarks.map(hand => {
      const x = hand.reduce((sum, p) => sum + p.x, 0) / hand.length;
      const y = hand.reduce((sum, p) => sum + p.y, 0) / hand.length;
      return { x, y };
  });

  let movementIntensity = 0;

  // If we tracked the same number of hands in the last frame, calculate the distance they moved
  if (previousHandCenters.length === currentCenters.length) {
      for (let i = 0; i < currentCenters.length; i++) {
          const dx = currentCenters[i].x - previousHandCenters[i].x;
          const dy = currentCenters[i].y - previousHandCenters[i].y;
          // Pythagorean theorem for distance
          movementIntensity += Math.sqrt(dx * dx + dy * dy);
      }
  }

  // Save current centers for the next frame's calculation
  previousHandCenters = currentCenters;

  // Normalize the raw movement decimal into a 0-100 score
  const expressivenessScore = Math.min(100, Math.round(movementIntensity * 1500));
  
  // If the score is high enough, they are actively gesturing, not just resting their hands
  const isUsingHands = expressivenessScore > 15; 

  return { isUsingHands, expressivenessScore };
};
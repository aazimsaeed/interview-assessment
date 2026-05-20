export const createInterviewSession = () => ({
  totalFrames: 0,
  eyeContactFrames: 0,
  emotionCounts: { Happy: 0, Nervous: 0, Neutral: 0 },
  movementIntensities: [],
  misalignedFrames: 0,
  speechMetrics: { wpm: 0, fillerCount: 0, totalWords: 0 }, // Added speech metrics
  startTime: performance.now(),
});

export const updateMetrics = (session, emotion, eyeContact, movement) => {
  session.totalFrames++;
  if (eyeContact.isContact) session.eyeContactFrames++;
  session.emotionCounts[emotion.dominant]++;
  session.movementIntensities.push(movement.intensity);
  if (session.movementIntensities.length > 500) session.movementIntensities.shift();
  if (movement.alignment !== "Good") session.misalignedFrames++;
};

export const generateReport = (session) => {
  const durationSec = (performance.now() - session.startTime) / 1000;
  if (session.totalFrames === 0) return null;

  const eyeContactPercentage = Math.round((session.eyeContactFrames / session.totalFrames) * 100);
  const happyFreq = Math.round((session.emotionCounts.Happy / session.totalFrames) * 100);
  const nervousFreq = Math.round((session.emotionCounts.Nervous / session.totalFrames) * 100);
  const avgMovement = session.movementIntensities.reduce((a, b) => a + b, 0) / (session.movementIntensities.length || 1);
  const alignmentScore = Math.round(100 - ((session.misalignedFrames / session.totalFrames) * 100));

  let confidenceScore = (eyeContactPercentage * 0.4) + ((100 - nervousFreq) * 0.3) + (alignmentScore * 0.2);
  
  if (avgMovement > 30) confidenceScore -= 15;
  if (avgMovement > 50) confidenceScore -= 30;

  const strengths = [];
  const weaknesses = [];
  const suggestions = [];

  // --- SPEECH ANALYSIS INTEGRATION ---
  const { wpm, fillerCount } = session.speechMetrics;

  if (wpm > 170) {
    confidenceScore -= 10;
    weaknesses.push(`Pace is too fast (${wpm} WPM).`);
    suggestions.push("Try to slow down your speaking pace to sound more composed.");
  } else if (wpm < 100 && wpm > 0) {
    confidenceScore -= 5;
    weaknesses.push(`Pace is a bit slow (${wpm} WPM).`);
  } else if (wpm >= 100 && wpm <= 170) {
    strengths.push(`Excellent speaking pace (${wpm} WPM).`);
  }

  // Strict Filler Word Check
  if (fillerCount > 5) {
    confidenceScore -= (fillerCount * 2); // Heavy penalty for filler words
    weaknesses.push(`High use of filler words (${fillerCount} detected).`);
    suggestions.push("Pause silently to collect your thoughts instead of saying 'um' or 'like'.");
  } else if (fillerCount === 0 && wpm > 0) {
    strengths.push("Excellent speech fluidity with no filler words.");
  }

  confidenceScore = Math.max(0, Math.min(100, Math.round(confidenceScore)));

  // Existing Visual Feedback logic
  if (eyeContactPercentage >= 70) strengths.push("Excellent eye contact maintained.");
  else {
    weaknesses.push("Poor eye contact.");
    suggestions.push("Try looking directly into the camera lens, not at the screen.");
  }

  if (nervousFreq < 20) strengths.push("Remained calm and composed.");
  else weaknesses.push("Frequent nervous expressions detected.");

  if (avgMovement > 40) weaknesses.push("Excessive head movement or fidgeting.");
  if (alignmentScore < 80) weaknesses.push("Frequent head tilting or poor body alignment.");

  return {
    duration: Math.round(durationSec),
    metrics: {
      eyeContactPercentage,
      facialExpressionFrequency: { happy: happyFreq, nervous: nervousFreq, neutral: 100 - (happyFreq + nervousFreq) },
      headMovementIntensity: Math.round(avgMovement),
      speech: { wpm, fillerCount }, // Pass speech data to final report
      confidenceScore
    },
    report: { strengths, weaknesses, suggestions }
  };
};
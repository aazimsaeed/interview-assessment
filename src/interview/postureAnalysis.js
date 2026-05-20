export const analyzePosture = (poseLandmarks) => {
  // If no body is detected, default to Unknown
  if (!poseLandmarks || poseLandmarks.length === 0) {
      return { posture: "Unknown", isClosed: false };
  }

  // Assuming 1 candidate in the frame
  const lm = poseLandmarks[0]; 

  // MediaPipe Pose Indices: 
  // Shoulders (11, 12), Elbows (13, 14), Wrists (15, 16)
  const lShoulder = lm[11];
  const rShoulder = lm[12];
  const lWrist = lm[15];
  const rWrist = lm[16];

  // If upper body isn't fully in frame, we can't accurately judge
  if (!lShoulder || !rShoulder || !lWrist || !rWrist) {
      return { posture: "Open & Professional", isClosed: false };
  }

  // Calculate the physical distance between the shoulders to establish a baseline width
  const shoulderDist = Math.abs(lShoulder.x - rShoulder.x);
  
  // Calculate the physical distance between the wrists
  const wristDist = Math.abs(lWrist.x - rWrist.x);

  // LOGIC: If wrists are very close together (less than half the shoulder width) 
  // AND the wrists are raised up near the chest/torso area, the arms are likely crossed or clenched.
  const areWristsClose = wristDist < (shoulderDist * 0.5);
  const areWristsUp = lWrist.y < (lShoulder.y + 0.3) && rWrist.y < (rShoulder.y + 0.3);

  let isClosed = false;
  let posture = "Open & Professional";

  if (areWristsClose && areWristsUp) {
      isClosed = true;
      posture = "Closed (Crossed Arms / Clenched)";
  }

  return { posture, isClosed };
};
// Helper to extract a specific blendshape score safely, regardless of data structure
const bs = (blendshapes, name) => {
  if (!blendshapes) return 0;
  
  let categories = [];
  // Handle different Mediapipe data structures dynamically
  if (blendshapes.categories) {
     categories = blendshapes.categories; 
  } else if (blendshapes[0]?.categories) {
     categories = blendshapes[0].categories; 
  } else if (Array.isArray(blendshapes)) {
     categories = blendshapes; 
  }
  
  const match = categories.find((c) => c.categoryName === name);
  return match ? match.score : 0;
};

export const detectInterviewEmotion = (
  blendshapes,
  isClosedPosture = false,
  headMovementIntensity = 0,
  blinksPerMinute = 0
) => {
  if (!blendshapes) return { happy: 0, nervous: 0, neutral: 1, dominant: "Neutral" };

  // Happy: Smiles and cheek raises (Amplified for better sensitivity)
  const smile = (bs(blendshapes, "mouthSmileLeft") + bs(blendshapes, "mouthSmileRight")) / 2;
  const cheekRaise = (bs(blendshapes, "cheekSquintLeft") + bs(blendshapes, "cheekSquintRight")) / 2;
  const happyScore = Math.min(1, (smile * 2.5) + (cheekRaise * 1.5));

  // Nervous: Frowning, lip biting/pressing, inner brow raise (Amplified)
  const frown = (bs(blendshapes, "mouthFrownLeft") + bs(blendshapes, "mouthFrownRight")) / 2;
  const lipPress = (bs(blendshapes, "mouthPressLeft") + bs(blendshapes, "mouthPressRight")) / 2;
  const browWorry = bs(blendshapes, "browInnerUp");
  let nervousScore = Math.min(1, (frown * 2.0) + (lipPress * 1.5) + (browWorry * 2.0));

  // Determine dominant emotion with a highly responsive threshold
  let dominant = "Neutral";
  
  // If expression scores are higher than 25%, override Neutral
  if (happyScore > 0.25 && happyScore > nervousScore) {
    dominant = "Happy";
  } else if (nervousScore > 0.25 && nervousScore > happyScore) {
    dominant = "Nervous";
  }

  // --- STRICT NERVOUS OVERRIDE LOGIC ---
  const isRapidBlinking = blinksPerMinute > 30;
  const isFrequentMovement = headMovementIntensity > 30;

  // Override to Nervous if arms are crossed, head moves too much, or blinking too fast
  if (isClosedPosture || isFrequentMovement || isRapidBlinking) {
    dominant = "Nervous";
    // Boost the nervous score so it aligns with the dominant trait
    nervousScore = Math.max(nervousScore, 0.85); 
  }

  // Calculate neutral as whatever is left over
  let neutralScore = Math.max(0, 1 - (happyScore + nervousScore));

  return { happy: happyScore, nervous: nervousScore, neutral: neutralScore, dominant };
};
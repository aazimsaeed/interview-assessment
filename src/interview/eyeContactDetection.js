// Helper to extract a specific blendshape score safely
const bs = (blendshapes, name) => {
  if (!blendshapes) return 0;
  
  let categories = [];
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

export const detectEyeContact = (blendshapes, yawDeg, pitchDeg) => {
  // 1. Increased head turn tolerance. 
  // Allow up to 25 degrees of head turning/nodding before failing eye contact.
  if (Math.abs(yawDeg) > 25 || Math.abs(pitchDeg) > 25) {
    return { isContact: false, score: 0 };
  }

  // 2. Check eye gaze blendshapes (pupil tracking)
  const gazeLeft = (bs(blendshapes, "eyeLookInLeft") + bs(blendshapes, "eyeLookOutRight")) / 2;
  const gazeRight = (bs(blendshapes, "eyeLookOutLeft") + bs(blendshapes, "eyeLookInRight")) / 2;
  const gazeUp = (bs(blendshapes, "eyeLookUpLeft") + bs(blendshapes, "eyeLookUpRight")) / 2;
  const gazeDown = (bs(blendshapes, "eyeLookDownLeft") + bs(blendshapes, "eyeLookDownRight")) / 2;

  // Find the most extreme direction the eyes are looking
  const maxGazeDeviation = Math.max(gazeLeft, gazeRight, gazeUp, gazeDown);

  // 3. Relaxed pupil threshold. 
  // Previously we required deviation to be < 0.15. Now we allow up to 0.40.
  // This means you can naturally look around the screen/camera without it failing.
  const isContact = maxGazeDeviation < 0.40;

  // Generate a smooth score between 0 and 1 for the report metrics
  const score = Math.max(0, 1 - (maxGazeDeviation / 0.6));

  return { isContact, score };
};
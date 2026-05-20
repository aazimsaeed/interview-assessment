export const trackMovementAndAlignment = (matrix, previousPose) => {
  if (!matrix) return { intensity: 0, alignment: "Good", currentPose: null };

  // Calculate Forward Yaw, Pitch, Roll from transformation matrix
  const yaw = (Math.atan2(matrix[2], matrix[10]) * 180) / Math.PI;
  const pitch = (Math.asin(-matrix[6]) * 180) / Math.PI;
  const roll = (Math.atan2(matrix[4], matrix[5]) * 180) / Math.PI;

  const currentPose = { yaw, pitch, roll, time: performance.now() };
  let intensity = 0;

  if (previousPose) {
    const dt = (currentPose.time - previousPose.time) / 1000; // seconds
    if (dt > 0) {
      const deltaY = Math.abs(currentPose.yaw - previousPose.yaw);
      const deltaP = Math.abs(currentPose.pitch - previousPose.pitch);
      const deltaR = Math.abs(currentPose.roll - previousPose.roll);
      
      // Speed of movement (degrees per second)
      intensity = (deltaY + deltaP + deltaR) / dt; 
    }
  }

  // Body/Head alignment based on roll (tilt)
  let alignment = "Good";
  if (Math.abs(roll) > 10) {
    alignment = "Tilted";
  }

  return { intensity, alignment, currentPose };
};
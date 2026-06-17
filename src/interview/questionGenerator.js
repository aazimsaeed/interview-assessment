export const speakQuestion = (text, onEndCallback) => {
  if (!('speechSynthesis' in window)) {
    console.warn("Text-to-Speech is not supported in this browser.");
    if (onEndCallback) onEndCallback();
    return;
  }
  
  // Stop any currently playing audio so they don't overlap
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  
  // 🐛 THE FIX: Save the utterance to the window object. 
  // This prevents Chrome from garbage collecting it mid-sentence!
  window._currentUtterance = utterance;
  
  utterance.rate = 0.95; // Slightly slower for clear interviewing
  utterance.pitch = 1.0;
  utterance.lang = 'en-US';
  
  if (onEndCallback) {
    utterance.onend = () => {
        onEndCallback();
        window._currentUtterance = null; // Clean up after it finishes
    };
    utterance.onerror = () => {
        onEndCallback();
        window._currentUtterance = null; // Clean up if it fails
    };
  }
  
  window.speechSynthesis.speak(utterance);
};

export const evaluateAnswer = async (question, userAnswer, interviewId = "test-session") => {

  if (!userAnswer || userAnswer.trim().length < 10) {
    return { 
      score: 0, 
      feedback: "Answer was too short to evaluate. Please speak clearly and provide more detail.", 
      idealAnswer: "" 
    };
  }

  try {
    // Calling the FastAPI backend instead of Gemini
    const response = await fetch('http://localhost:8000/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interview_id: interviewId,
        question: question,
        user_answer: userAnswer
      })
    });

    if (!response.ok) {
       throw new Error("Failed to evaluate answer via backend server.");
    }

    const data = await response.json();
    
    return {
      score: data.score || 0,
      feedback: data.feedback || "Unable to parse feedback.",
      idealAnswer: data.idealAnswer || "No ideal answer provided."
    };
  } catch (error) {
    console.error("Failed to evaluate answer:", error);
    return { 
      score: 0, 
      feedback: "Evaluation failed due to a network or API error. Make sure the Python server is running.", 
      idealAnswer: "" 
    };
  }
};
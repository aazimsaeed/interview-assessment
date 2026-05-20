import React, { useEffect, useRef, useState } from "react";
import { FaceLandmarker, PoseLandmarker, HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// Import Shared Checks
import { checkBrightness } from "../check/brightnesscheck";
import { facedistancecheck } from "../check/facedistancecheck";
import { checkFacePosition } from "../check/facepositioncheck";
import { unevenLightingCheck } from "../check/unevenlightingcheck";

// Import Shared Detection
import { getfacebox } from "../detection/getFacebox";
import { getFaceArea } from "../detection/getFaceArea";
import { getFaceCenter } from "../detection/getFaceCenter";
import { getFaceBrightness } from "../detection/getFaceBrightness";
import { getCheekBrightness } from "../detection/getCheekBrightness";

// Import Interview Modules
import { detectInterviewEmotion } from "../interview/emotionDetection";
import { detectEyeContact } from "../interview/eyeContactDetection";
import { trackMovementAndAlignment } from "../interview/movementTracking";
import { createInterviewSession, updateMetrics, generateReport } from "../interview/interviewMetrics";

// Import Advanced Body Language & Audio Modules
import { detectBlinkRate } from "../interview/blinkDetection";
import { analyzePosture } from "../interview/postureAnalysis";
import { analyzeHandGestures } from "../interview/handGestureAnalysis";
import { createSpeechTracker } from "../audio/speechAnalysis";
import { speakQuestion, evaluateAnswer } from "../interview/questionGenerator";

const getCheekPoints = (faceLM) => {
  if (!faceLM?.length) return [{ x: 0.42, y: 0.58 }, { x: 0.58, y: 0.58 }];
  return [
    faceLM[205] || faceLM[187] || faceLM[0],
    faceLM[425] || faceLM[411] || faceLM[0],
  ];
};

function drawFace(ctx, canvas, landmarks) {
  ctx.fillStyle = "rgba(56,189,248,0.4)";
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(point.x * canvas.width, point.y * canvas.height, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  const faceOval = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
    378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
    162, 21, 54, 103, 67, 109,
  ];
  ctx.strokeStyle = "rgba(168,85,247,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let index = 0; index < faceOval.length; index += 1) {
    const point = landmarks[faceOval[index]];
    if (!point) continue;
    if (index === 0)
      ctx.moveTo(point.x * canvas.width, point.y * canvas.height);
    else ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawSparkline(ctx, buffer, canvas, value) {
  buffer.push(value);
  buffer.shift();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  for (let index = 0; index < buffer.length; index += 1) {
    const x = (index / (buffer.length - 1)) * canvas.width;
    const y = canvas.height - buffer[index] * canvas.height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#38bdf8";
  ctx.stroke();
}

const calculateLiveMeters = (session, currentStats) => {
  if (!session || session.totalFrames === 0) {
    return { attention: 100, nervousness: 0, confidence: 100 };
  }
  
  const eyeContactPercentage = (session.eyeContactFrames / session.totalFrames) * 100;
  const nervousFreq = (session.emotionCounts.Nervous / session.totalFrames) * 100;
  const alignmentScore = 100 - ((session.misalignedFrames / session.totalFrames) * 100);
  const avgMovement = session.movementIntensities.reduce((a, b) => a + b, 0) / (session.movementIntensities.length || 1);

  let attentionScore = (eyeContactPercentage * 0.7) + (alignmentScore * 0.3);

  let nervousnessScore = nervousFreq;
  if (avgMovement > 30) nervousnessScore += 15;
  if (avgMovement > 50) nervousnessScore += 20;
  if (currentStats.stressLevel.includes("Rapid")) nervousnessScore += 20;
  
  if (session.speechMetrics && session.speechMetrics.fillerCount > 5) {
      nervousnessScore += (session.speechMetrics.fillerCount * 2);
  }

  let confidenceScore = 100 - nervousnessScore;
  if (currentStats.postureStatus.includes("Closed")) confidenceScore -= 20;
  
  if (session.speechMetrics) {
      const wpm = session.speechMetrics.wpm;
      if (wpm > 170) confidenceScore -= 15; 
      else if (wpm < 100 && wpm > 0) confidenceScore -= 10; 
  }

  return {
    attention: Math.max(0, Math.min(100, Math.round(attentionScore))),
    nervousness: Math.max(0, Math.min(100, Math.round(nervousnessScore))),
    confidence: Math.max(0, Math.min(100, Math.round(confidenceScore)))
  };
};

const INITIAL_UI = {
  status: "Idle",
  hasError: false,
  brightness: 0,
  lightingStatus: "checking...",
  lightingSuggestion: "Checking lighting...",
  showLightingPopup: false,
  showUnevenLightingPopup: false,
  unevenLightingStatus: "Checking Light Balance",
  unevenLightingSuggestion: "Checking for uneven lighting...",
  faceDistanceStatus: "Checking Distance",
  faceDistanceSuggestion: "Checking if you're the right distance from the camera...",
  showFaceDistancePopup: false,
  facePositionStatus: "Checking Face Position...",
  facePositionSuggestion: "Checking if your face is well positioned in the frame...",
  showFacePositionPopup: false,
  fps: "fps: --",
};

const INITIAL_LIVE_STATS = { 
  emotion: "Neutral", 
  eyeContact: true, 
  alignment: "Good", 
  confidence: 100,
  nervousness: 0,
  attention: 100,
  facesDetected: 0,
  isUsingHands: false,
  postureStatus: "Open & Professional",
  blinks: 0,
  stressLevel: "Normal",
  speechMetrics: { wpm: 0, fillerWords: 0 }
};

export default function InterviewMonitor({ studentName, customQuestions, onExit, onFinish }) {
  const videoRef = useRef(null);
  const processCanvasRef = useRef(null);
  const overlayRef = useRef(null);
  const sparkRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);
  const runningRef = useRef(false);
  
  const faceLandmarkerRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const speechTrackerRef = useRef(null);

  const timelineRef = useRef([]);
  const snapshotsRef = useRef([]);
  const lastSnapshotTimeRef = useRef(0);
  const sessionStartTimeRef = useRef(0);
  
  // Per-question tracking
  const snapshotLimitsRef = useRef({ confident: 0, focused: 0, nervous: 0 });

  const badLightiningRef = useRef(null);
  const unevenLightingRef = useRef(null);
  const faceDistRef = useRef(null);
  const facePostRef = useRef(null);
  const previousPoseRef = useRef(null);
  const sessionRef = useRef(null);

  const sparkBufRef = useRef(new Array(180).fill(0));
  const fpsDataRef = useRef({ frames: 0, lastUpdate: performance.now() });

  const [ui, setUi] = useState(INITIAL_UI);
  const [liveStats, setLiveStats] = useState(INITIAL_LIVE_STATS);
  
  const [questionQueue, setQuestionQueue] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [hasStartedAsking, setHasStartedAsking] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  
  const [liveTranscript, setLiveTranscript] = useState("");
  const currentTranscriptRef = useRef("");

  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  const [timeLeft, setTimeLeft] = useState(60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerTimeoutRef = useRef(null);

  const [overlayVisible, setOverlayVisible] = useState(true);
  const overlayVisibleRef = useRef(true);
  overlayVisibleRef.current = overlayVisible;

  useEffect(() => {
    if (customQuestions) {
      const parsedQuestions = customQuestions
        ?.split('\n')
        ?.map(q => q.trim())
        ?.filter(q => q.length > 0);
      setQuestionQueue(parsedQuestions || []);
    }
  }, [customQuestions]);

  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerTimeoutRef.current = setTimeout(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (isTimerRunning && timeLeft === 0) {
      submitAnswer();
    }

    return () => {
      if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);
    };
  }, [isTimerRunning, timeLeft]);

  function resetSession() {
    setUi(INITIAL_UI);
    setLiveStats(INITIAL_LIVE_STATS);
    setCurrentQuestion("");
    setIsAsking(false);
    setIsEvaluating(false);
    setHasStartedAsking(false);
    setIsCameraOn(true);
    setIsMicOn(true);
    setAnswerResult(null);
    currentTranscriptRef.current = "";
    setLiveTranscript(""); 
    sessionRef.current = null;
    timelineRef.current = [];
    snapshotsRef.current = []; 
    lastSnapshotTimeRef.current = 0; 
    snapshotLimitsRef.current = { confident: 0, focused: 0, nervous: 0 }; 
    sessionStartTimeRef.current = Date.now();
    sparkBufRef.current = new Array(180).fill(0);
    fpsDataRef.current = { frames: 0, lastUpdate: performance.now() };

    setTimeLeft(60);
    setIsTimerRunning(false);
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);

    if (sparkRef.current) {
      const ctx = sparkRef.current.getContext("2d");
      ctx.clearRect(0, 0, sparkRef.current.width, sparkRef.current.height);
    }
  }

  const toggleCamera = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCameraOn;
        setIsCameraOn(!isCameraOn);
      }
    }
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(!isMicOn);
      }
    }
  };

  async function initModels() {
    if (faceLandmarkerRef.current) return;
    setUi(prev => ({ ...prev, status: "Loading AI Models..." }));
    
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    
    faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task" },
      runningMode: "VIDEO",
      numFaces: 5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });

    poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task" },
      runningMode: "VIDEO",
      numPoses: 1
    });

    handLandmarkerRef.current = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task" },
      runningMode: "VIDEO",
      numHands: 2
    });
  }

  const askNextQuestion = () => {
    if (questionQueue?.length === 0) {
      endInterview();
      return;
    }

    // RESET SNAPSHOT QUOTAS FOR THE NEW 60S CYCLE
    snapshotLimitsRef.current = { confident: 0, focused: 0, nervous: 0 };

    setIsAsking(true);
    setHasStartedAsking(true);
    setAnswerResult(null); 
    
    setIsTimerRunning(false);
    setTimeLeft(60);
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);

    if (speechTrackerRef.current) {
      speechTrackerRef.current.stop(); 
      speechTrackerRef.current.clearTranscript();
    }
    
    currentTranscriptRef.current = ""; 
    setLiveTranscript(""); 
    
    const nextQuestionText = questionQueue[0];
    setQuestionQueue(prevQueue => prevQueue.slice(1));

    setCurrentQuestion(nextQuestionText);
    
    speakQuestion(nextQuestionText, () => {
      setIsAsking(false);
      if (speechTrackerRef.current) {
        speechTrackerRef.current.start(); 
      }
      setIsTimerRunning(true);
    });
  };

  const submitAnswer = async () => {
    setIsEvaluating(true);
    
    setIsTimerRunning(false);
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);

    if (speechTrackerRef.current) {
       speechTrackerRef.current.stop(); 
    }
    
    const answeredQuestion = currentQuestion;
    const answerText = currentTranscriptRef.current;
    const currentConfidence = liveStats.confidence;
    const currentFocus = liveStats.attention;
    const currentStress = liveStats.nervousness;

    let answerSnapshotUrl = null;
    let answerPhase = "Focused"; 
    
    if (currentStress >= 40) answerPhase = "Nervous";
    else if (currentConfidence >= 80) answerPhase = "Confident";
    else answerPhase = "Focused";

    if (processCanvasRef.current) {
        answerSnapshotUrl = processCanvasRef.current.toDataURL("image/jpeg", 0.5);
        
        const elapsedSec = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        const formattedTime = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;
        
        snapshotsRef.current.push({
            id: Date.now(),
            phase: answerPhase,
            time: formattedTime,
            url: answerSnapshotUrl
        });
        
        lastSnapshotTimeRef.current = performance.now();
    }

    const evaluation = await evaluateAnswer(answeredQuestion, answerText);
    
    setAnswerResult(evaluation);
    setIsEvaluating(false);

    timelineRef.current.push({
      qId: timelineRef.current.length + 1,
      question: answeredQuestion,
      answer: answerText || "(No audible answer detected)",
      metrics: {
         confidence: currentConfidence,
         focus: currentFocus,
         stress: currentStress
      },
      snapshot: answerSnapshotUrl,
      phase: answerPhase 
    });
    
    const textToSpeak = `You scored ${evaluation.score} out of 100. ${evaluation.feedback}`;
    
    speakQuestion(textToSpeak, () => {
        if (speechTrackerRef.current) {
            speechTrackerRef.current.start(); 
        }
    });

    setCurrentQuestion("");
    currentTranscriptRef.current = ""; 
    setLiveTranscript("");
  };

  async function start() {
    resetSession(); 
    sessionRef.current = createInterviewSession();

    try {
      await initModels();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } }, 
        audio: true 
      });
      streamRef.current = stream;

      speechTrackerRef.current = createSpeechTracker((metrics) => {
        currentTranscriptRef.current = metrics.fullTranscript || "";
        setLiveTranscript(metrics.fullTranscript || "");

        setLiveStats(prev => ({
          ...prev,
          speechMetrics: { wpm: metrics.wpm, fillerWords: metrics.fillerCount }
        }));
        
        if (sessionRef.current) {
           sessionRef.current.speechMetrics = { ...metrics, fillerWords: metrics.fillerCount };
           
           if (metrics.fillerCount > 20) {
             setLiveStats(prev => ({ ...prev, emotion: "Nervous (Too many filler words)" }));
           }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        processCanvasRef.current = document.createElement("canvas");
        processCanvasRef.current.width = videoRef.current.videoWidth;
        processCanvasRef.current.height = videoRef.current.videoHeight;

        if (overlayRef.current) {
            overlayRef.current.width = videoRef.current.videoWidth;
            overlayRef.current.height = videoRef.current.videoHeight;
        }
        
        runningRef.current = true;
        frameRef.current = requestAnimationFrame(loop);
        setUi(prev => ({ ...prev, status: "Recording...", hasError: false }));

        if (studentName) {
           speakQuestion(`Hello ${studentName}, let's begin the interview. Click Ask Me A Question when you are ready.`);
        }
      }
    } catch (error) {
      console.error(error);
      setUi(prev => ({ ...prev, status: "Error", hasError: true }));
    }
  }

  function endInterview() {
    runningRef.current = false;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    
    setIsTimerRunning(false);
    if (timerTimeoutRef.current) clearTimeout(timerTimeoutRef.current);

    if (speechTrackerRef.current) {
        speechTrackerRef.current.turnOff();
    }
    
    if (overlayRef.current) {
        const ctx = overlayRef.current.getContext("2d");
        ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }

    if (sessionRef.current) {
      const report = generateReport(sessionRef.current);
      if (report) {
         report.timeline = timelineRef.current;
         report.snapshots = snapshotsRef.current; 
      }
      if (onFinish) onFinish(report);
    }
  }

  async function loop() {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const pCanvas = processCanvasRef.current;
    const overlay = overlayRef.current;
    
    const faceLM = faceLandmarkerRef.current;
    const poseLM = poseLandmarkerRef.current;
    const handLM = handLandmarkerRef.current;

    if (video && pCanvas && faceLM && poseLM && handLM && video.readyState >= 2 && isCameraOn) {
      const pctx = pCanvas.getContext("2d");
      pctx.drawImage(video, 0, 0, pCanvas.width, pCanvas.height);
      const ts = performance.now();
      
      const faceResult = faceLM.detectForVideo(video, ts);
      const poseResult = poseLM.detectForVideo(video, ts);
      const handResult = handLM.detectForVideo(video, ts);

      let currentConfidence = 0;
      const numFaces = faceResult?.faceLandmarks?.length || 0;

      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (numFaces > 0) {
        const landmarks = faceResult.faceLandmarks[0];
        const blendshapes = faceResult.faceBlendshapes[0];
        const matrix = faceResult.facialTransformationMatrixes?.[0]?.data;
        const cWidth = pCanvas.width;
        const cHeight = pCanvas.height;

        if (overlayVisibleRef.current) {
            faceResult.faceLandmarks.forEach(points => drawFace(ctx, overlay, points));
        }

        const { minX, maxX, minY, maxY, x1, y1, faceWidth, faceHeight } = getfacebox(landmarks, cWidth, cHeight);
        const brightness = getFaceBrightness(pctx, x1, y1, faceWidth, faceHeight);
        const lightingResults = checkBrightness(brightness, badLightiningRef);
        const { lightingDifference } = getCheekBrightness(pctx, landmarks, cWidth, cHeight, getCheekPoints);
        const unevenResults = unevenLightingCheck(lightingDifference, unevenLightingRef);
        const { FaceArea } = getFaceArea(minX, maxX, minY, maxY);
        const distanceResults = facedistancecheck(FaceArea, faceDistRef);
        const { faceCenterX, faceCenterY } = getFaceCenter(minX, maxX, minY, maxY);
        const positionResults = checkFacePosition(faceCenterX, faceCenterY, facePostRef);

        const blinkData = detectBlinkRate(blendshapes, ts);
        const postureData = analyzePosture(poseResult.landmarks);
        const handData = analyzeHandGestures(handResult.landmarks);

        const movement = trackMovementAndAlignment(matrix, previousPoseRef.current);
        previousPoseRef.current = movement.currentPose;
        const eyeContact = detectEyeContact(blendshapes, movement.currentPose?.yaw || 0, movement.currentPose?.pitch || 0);
        
        let emotion = detectInterviewEmotion(
          blendshapes, 
          postureData.isClosed, 
          movement.intensity, 
          blinkData.blinksPerMinute
        );

        if ((sessionRef.current?.speechMetrics?.fillerWords || 0) > 20) {
           emotion.dominant = "Nervous (Too many filler words)";
        }

        updateMetrics(sessionRef.current, emotion, eyeContact, movement);

        const meters = calculateLiveMeters(sessionRef.current, {
            stressLevel: blinkData.stressLevel,
            postureStatus: postureData.posture
        });
        
        currentConfidence = meters.confidence / 100; 

        // STRICT DYNAMIC BACKGROUND SNAPSHOT CAPTURE SYSTEM
        if (ts - lastSnapshotTimeRef.current > 5000) {
            let capturedPhase = null;

            if (meters.nervousness > 40 && snapshotLimitsRef.current.nervous < 1) {
                capturedPhase = "Nervous";
                snapshotLimitsRef.current.nervous += 1;
            } 
            else if (meters.confidence > 80 && snapshotLimitsRef.current.confident < 2) {
                capturedPhase = "Confident";
                snapshotLimitsRef.current.confident += 1;
            } 
            else if (meters.attention > 80 && snapshotLimitsRef.current.focused < 1) {
                capturedPhase = "Focused";
                snapshotLimitsRef.current.focused += 1;
            }

            if (capturedPhase) {
                const snapshotDataUrl = pCanvas.toDataURL("image/jpeg", 0.5);
                const elapsedSec = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
                const formattedTime = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(elapsedSec % 60).padStart(2, '0')}`;

                snapshotsRef.current.push({
                    id: Date.now(),
                    phase: capturedPhase,
                    time: formattedTime,
                    url: snapshotDataUrl
                });
                
                lastSnapshotTimeRef.current = ts;
            }
        }

        setUi(prev => ({
          ...prev,
          brightness: Math.round(brightness),
          ...lightingResults, ...unevenResults, ...distanceResults,
          facePositionStatus: positionResults.facePositionStatus,
          facePositionSuggestion: positionResults.facePositionSuggestion,
          showFacePositionPopup: positionResults.showFacePositionPopup,
        }));

        setLiveStats(prev => ({
          ...prev,
          emotion: emotion.dominant,
          eyeContact: eyeContact.isContact,
          alignment: movement.alignment,
          confidence: meters.confidence,
          nervousness: meters.nervousness,
          attention: meters.attention,
          facesDetected: numFaces,
          isUsingHands: handData.isUsingHands,
          postureStatus: postureData.posture,
          blinks: blinkData.blinksPerMinute,
          stressLevel: blinkData.stressLevel
        }));

      } else {
        setUi(prev => ({
           ...prev, 
           facePositionStatus: "No Face Detected ❌",
           facePositionSuggestion: "Please look into the camera."
        }));
        setLiveStats(prev => ({ ...prev, facesDetected: 0, isUsingHands: false }));
      }

      const sparkCanvas = sparkRef.current;
      if (sparkCanvas) {
        drawSparkline(sparkCanvas.getContext("2d"), sparkBufRef.current, sparkCanvas, currentConfidence);
      }
      
      fpsDataRef.current.frames += 1;
      if (ts - fpsDataRef.current.lastUpdate > 500) {
        const currentFps = (fpsDataRef.current.frames * 1000) / (ts - fpsDataRef.current.lastUpdate);
        fpsDataRef.current.frames = 0;
        fpsDataRef.current.lastUpdate = ts;
        setUi(prev => ({ ...prev, fps: `fps: ${currentFps.toFixed(1)}` }));
      }
    } else if (!isCameraOn) {
      const ctx = overlay?.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, overlay.width, overlay.height);
      setUi(prev => ({ ...prev, facePositionStatus: "Camera is Off ⏸️" }));
    }
    
    if (runningRef.current) frameRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => { return () => endInterview(); }, []);

  let askButtonText = "🎙️ Ask Me A Question";
  if (hasStartedAsking) {
    if (questionQueue?.length === 1) {
      askButtonText = "🎙️ Last Question";
    } else if (questionQueue?.length > 1) {
      askButtonText = "🎙️ Next Question";
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <h1>Interview Assessment {studentName && `- ${studentName}`}</h1>
        <div className="row">
          {ui.status !== "Recording..." && (
            <button className="btn primary" onClick={start}>{ui.status === "Loading AI Models..." ? "Loading..." : "Start Interview"}</button>
          )}
          {ui.status === "Recording..." && (
            <>
              <button className="btn" onClick={toggleCamera} style={{ background: isCameraOn ? '#0f1720' : '#b91c1c', color: 'white' }}>
                {isCameraOn ? "📷 Turn Off Camera" : "📷 Turn On Camera"}
              </button>
              <button className="btn" onClick={toggleMic} style={{ background: isMicOn ? '#0f1720' : '#b91c1c', color: 'white' }}>
                {isMicOn ? "🎤 Mute Mic" : "🎤 Unmute Mic"}
              </button>
              <button className="btn" onClick={() => setOverlayVisible((v) => !v)}>Toggle overlay</button>
              <button className="btn" onClick={endInterview} style={{ background: '#ef4444', color: 'white', borderColor: '#ef4444' }}>
                End & Analyze
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app">
        <section className="card videoWrap">
          {!isCameraOn && (
            <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '1.5rem', zIndex: 1 }}>
              Camera is Paused
            </div>
          )}
          <video ref={videoRef} autoPlay playsInline muted />
          <canvas ref={overlayRef} className={`overlay${overlayVisible ? "" : " hidden"}`} style={{ zIndex: 2 }} />
          
          {isCameraOn && liveTranscript && (
            <div style={{
              position: "absolute", top: "20px", left: "20px",
              background: "rgba(15, 23, 32, 0.85)", padding: "15px", borderRadius: "12px", 
              border: "1px solid #1e2a36", color: "#e6edf3", zIndex: 10, 
              width: "28%", maxHeight: "80%", overflowY: "auto", textAlign: "left",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)", backdropFilter: "blur(4px)"
            }}>
              <h3 style={{ marginTop: 0, marginBottom: "8px", color: "#38bdf8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>
                🔴 Live Transcript
              </h3>
              <p style={{ fontSize: "1.05rem", margin: 0, lineHeight: "1.6" }}>
                {liveTranscript}
              </p>
            </div>
          )}

          {currentQuestion && (
            <div className="interview-popup" style={{ zIndex: 3 }}>
              <h3>Interviewer:</h3>
              <p style={{ fontSize: "1.2rem", margin: 0 }}>{currentQuestion}</p>
            </div>
          )}

          {ui.showLightingPopup && isCameraOn && <div className="lightingPopup"><h2>Poor Lighting Detected</h2><p>{ui.lightingSuggestion}</p></div>}
          {ui.showUnevenLightingPopup && isCameraOn && <div className="lightingPopup"><h2>Uneven Lighting</h2><p>{ui.unevenLightingSuggestion}</p></div>}
          {ui.showFaceDistancePopup && isCameraOn && <div className="lightingPopup"><h2>Distance Issue</h2><p>{ui.faceDistanceSuggestion}</p></div>}
          {ui.showFacePositionPopup && isCameraOn && <div className="lightingPopup"><h2>Positioning Issue</h2><p>{ui.facePositionSuggestion}</p></div>}
        </section>

        <aside className="card pane">
          {ui.status === "Recording..." && !currentQuestion && (
            <div style={{ marginBottom: "20px" }}>
              {hasStartedAsking && questionQueue?.length === 0 ? (
                <button 
                  className="btn" 
                  onClick={endInterview} 
                  style={{ width: "100%", padding: "12px", background: "#ef4444", color: "white", borderColor: "#b91c1c", fontWeight: "bold" }}
                >
                  🛑 End and Analyze
                </button>
              ) : (
                <button 
                  className="btn primary" 
                  onClick={askNextQuestion} 
                  disabled={isAsking} 
                  style={{ width: "100%", padding: "12px" }}
                >
                  {isAsking ? "Asking..." : `${askButtonText} (${questionQueue?.length || 0} left)`}
                </button>
              )}
            </div>
          )}

          {ui.status === "Recording..." && currentQuestion && (
            <div style={{ marginBottom: "20px" }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                 <span style={{ color: timeLeft <= 10 ? '#ef4444' : '#38bdf8', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    ⏱️ Time Left: {timeLeft}s
                 </span>
              </div>

              <button className="btn" onClick={submitAnswer} disabled={isEvaluating} style={{ width: "100%", padding: "12px", background: "#22c55e", color: "white", borderColor: "#16a34a" }}>
                {isEvaluating ? "Evaluating Answer..." : "✅ Submit My Answer"}
              </button>
            </div>
          )}

          {answerResult && (
            <div className="notice" style={{ marginBottom: "20px", borderLeft: "4px solid #38bdf8", display: "flex", flexDirection: "column", gap: "10px" }}>
              <h3 style={{ marginTop: 0, marginBottom: "4px" }}>Answer Quality: {answerResult.score}/100</h3>
              
              <div>
                <span style={{ fontSize: "12px", textTransform: "uppercase", color: "#9fb0c3", letterSpacing: "0.5px" }}>Feedback</span>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>{answerResult.feedback}</p>
              </div>
            </div>
          )}

          <div className="kv">
            <div className="badge">Attention & Focus</div>
            <div className="attnPct" style={{ color: '#38bdf8' }}>{liveStats.attention}%</div>
          </div>
          <div className="meter" aria-label="Attention meter">
            <i style={{ width: `${liveStats.attention}%`, background: 'linear-gradient(90deg, #1e90ff, #38bdf8)' }} />
          </div>

          <div className="kv" style={{ marginTop: '15px' }}>
            <div className="badge">Overall Confidence</div>
            <div className="attnPct" style={{ color: '#22c55e' }}>{liveStats.confidence}%</div>
          </div>
          <div className="meter" aria-label="Confidence meter">
            <i style={{ width: `${liveStats.confidence}%`, background: 'linear-gradient(90deg, #16a34a, #22c55e)' }} />
          </div>

          <div className="kv" style={{ marginTop: '15px' }}>
            <div className="badge">Stress & Nervousness</div>
            <div className="attnPct" style={{ color: '#ef4444' }}>{liveStats.nervousness}%</div>
          </div>
          <div className="meter" aria-label="Nervousness meter">
            <i style={{ width: `${liveStats.nervousness}%`, background: 'linear-gradient(90deg, #b91c1c, #ef4444)' }} />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {liveStats.stressLevel.includes("Rapid") && (
              <div style={{ padding: '8px 12px', background: '#fef08a', color: '#854d0e', borderRadius: '6px', fontWeight: 'bold', border: '1px solid #fde047' }}>
                👀 High Stress Detected (Rapid Blinking)
              </div>
            )}
          </div>

          <h3 style={{ marginTop: '20px' }}>Behavioral Metrics</h3>
          <div className="kv"><span className="muted">Expression</span><b>{liveStats.emotion}</b></div>
          <div className="kv"><span className="muted">Eye Contact</span><b>{liveStats.eyeContact ? "Good ✅" : "Looking Away ⚠️"}</b></div>
          <div className="kv"><span className="muted">Head Posture</span><b>{liveStats.alignment === "Good" ? "Straight ✅" : "Tilted ⚠️"}</b></div>
          <div className="kv"><span className="muted">Body Posture</span><b>{liveStats.postureStatus}</b></div>
          <div className="kv"><span className="muted">Blink Rate (60s)</span><b>{liveStats.blinks} BPM</b></div>

          <h3 style={{ marginTop: '20px' }}>Speech Metrics</h3>
          <div className="kv">
            <span className="muted">Pace (WPM)</span>
            <b>{liveStats?.speechMetrics?.wpm || 0}</b> 
          </div>
          <div className="kv">
            <span className="muted">Filler Words</span>
            <b style={{ color: (liveStats?.speechMetrics?.fillerWords || 0) > 20 ? '#b91c1c' : 'inherit' }}>
              {liveStats?.speechMetrics?.fillerWords || 0}
            </b>
          </div>
          
          <h3 style={{ marginTop: '20px' }}>Environment Quality</h3>
          <div className="kv">
            <span className="muted">Faces Detected</span>
            <b>{liveStats.facesDetected} {liveStats.facesDetected > 1 && <span style={{ color: '#b91c1c' }}>⚠️</span>}</b>
          </div>
          <div className="kv"><span className="muted">Lighting Status</span><b>{ui.lightingStatus}</b></div>
          <div className="kv"><span className="muted">Light Balance</span><b>{ui.unevenLightingStatus}</b></div>
          <div className="kv"><span className="muted">Face distance</span><b>{ui.faceDistanceStatus}</b></div>
          <div className="kv"><span className="muted">Position status</span><b>{ui.facePositionStatus}</b></div>

          <div className="kv statsRow" style={{ marginTop: '20px' }}>
            <span className="muted tiny">Last 30s performance</span>
            <span className="muted tiny">{ui.fps}</span>
          </div>
          <canvas ref={sparkRef} className="spark" width="600" height="48" />
        </aside>
      </main>
    </div>
  );
}
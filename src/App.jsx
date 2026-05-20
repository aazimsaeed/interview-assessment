import React, { useState, useEffect } from 'react';

// Import Pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import SetupPage from './pages/SetupPage';
import InterviewMonitor from './pages/InterviewMonitor';
import DashboardPage from './pages/DashboardPage';
import InterviewerDashboard from './pages/InterviewerDashboard';
import RecruiterOptionsPage from './pages/RecruiterOptionsPage';

export default function App() {
  // Global App State (Updated to check localStorage first)
  const [currentPage, setCurrentPage] = useState("landing");
  const [authRole, setAuthRole] = useState(() => localStorage.getItem("authRole") || null);
  const [username, setUsername] = useState(() => localStorage.getItem("username") || "");
  
  // Interview Data State
  const [interviewData, setInterviewData] = useState(null);
  const [reportData, setReportData] = useState(null);
  
  // Recruiter Specific State
  const [interviewFormat, setInterviewFormat] = useState(null); 

  // ==========================================
  // BULLETPROOF BROWSER HISTORY FIX (Hash Routing)
  // ==========================================
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || 'landing';
      setCurrentPage(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (page) => {
    window.location.hash = page; 
  };
  // ==========================================

  // --- ROUTING LOGIC ---
  const handleLogin = (loggedInUsername) => {
    setUsername(loggedInUsername);
    
    // SAVE TO LOCAL STORAGE
    localStorage.setItem("username", loggedInUsername);
    localStorage.setItem("authRole", authRole); 

    if (authRole === "recruiter") {
      navigate("recruiter-options"); 
    } else {
      navigate("setup");
    }
  };

  const handleLogout = () => {
    setUsername("");
    setAuthRole(null);
    setInterviewFormat(null);
    
    // CLEAR LOCAL STORAGE
    localStorage.removeItem("username");
    localStorage.removeItem("authRole");
    
    navigate("landing");
  };

  return (
    <div className="app" style={{ display: 'block', minHeight: '100vh', padding: 0 }}>
      
      {/* 1. LANDING PAGE */}
      {currentPage === "landing" && (
        <LandingPage 
          onStartCandidate={() => { setAuthRole("candidate"); navigate("auth"); }}
          onStartRecruiter={() => { setAuthRole("recruiter"); navigate("auth"); }}
        />
      )}

      {/* 2. AUTHENTICATION */}
      {currentPage === "auth" && (
        <AuthPage 
          type={authRole} 
          onLogin={handleLogin} 
          onBack={handleLogout} 
        />
      )}

      {/* 3. RECRUITER FLOW */}
      {currentPage === "recruiter-options" && (
        <RecruiterOptionsPage 
          onSelectOption={(format) => {
            setInterviewFormat(format); 
            navigate("interviewer-dashboard"); 
          }}
          onBack={handleLogout}
        />
      )}

      {currentPage === "interviewer-dashboard" && (
        <InterviewerDashboard 
          username={username}
          format={interviewFormat} 
          onBack={() => navigate("recruiter-options")} 
          // --- NEW: Handle Recruiter Viewing Report ---
          onViewReport={(fetchedReport) => {
            setReportData(fetchedReport);
            navigate("dashboard");
          }}
        />
      )}

      {/* 4. CANDIDATE FLOW */}
      {currentPage === "setup" && (
        <SetupPage 
          username={username}
          onViewReport={(fetchedReport) => {
            setReportData(fetchedReport);
            navigate("dashboard");
          }}
          onStart={(data) => {
            setInterviewData(data);
            navigate("interview");
          }}
          onBack={handleLogout}
        />
      )}

      {currentPage === "interview" && (
        <div style={{ padding: '16px' }}>
            <InterviewMonitor 
              studentName={interviewData?.studentName}
              customQuestions={interviewData?.questions}
              onFinish={async (report) => {
                  if (interviewData?.id && report) {
                      try {
                          await fetch('http://localhost:8000/api/reports', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  interview_id: interviewData.id,
                                  candidate_name: interviewData.studentName,
                                  duration: report.duration,
                                  metrics: report.metrics,
                                  report: {
                                      strengths: report.report?.strengths || [],
                                      weaknesses: report.report?.weaknesses || [],
                                      suggestions: report.report?.suggestions || [],
                                      timeline: report.timeline || [],
                                      snapshots: report.snapshots || [] 
                                  }
                              })
                          });
                      } catch (err) {
                          console.error("Failed to save report to DB", err);
                      }
                  }
                  
                  setReportData(report);
                  navigate("dashboard");
              }}
              onExit={() => navigate("setup")}
            />
        </div>
      )}

      {currentPage === "dashboard" && (
        <DashboardPage 
          studentName={interviewData?.studentName || reportData?.candidate_name}
          report={reportData}
          onExit={() => {
            // --- NEW: Smart Exit Routing Based on Role ---
            if (authRole === "recruiter") {
              navigate("interviewer-dashboard");
            } else {
              navigate("setup");
            }
          }}
        />
      )}
    </div>
  );
}
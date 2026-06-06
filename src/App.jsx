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
  // Global App State
  const [currentPage, setCurrentPage] = useState("landing");
  const [authRole, setAuthRole] = useState(() => localStorage.getItem("authRole") || null);
  
  // Separate Usernames
  const [recruiterUsername, setRecruiterUsername] = useState(() => localStorage.getItem("recruiterUsername") || "");
  const [candidateUsername, setCandidateUsername] = useState(() => localStorage.getItem("candidateUsername") || "");
  
  // Interview Data State
  const [interviewData, setInterviewData] = useState(null);
  const [reportData, setReportData] = useState(null);
  
  // Recruiter Specific State
  const [interviewFormat, setInterviewFormat] = useState(null); 

  // ==========================================
  // ROUTING & BROWSER HISTORY FIX
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

  // Using `replaceHistory` parameter prevents the back button from returning to the previous state
  const navigate = (page, replaceHistory = false) => {
    if (replaceHistory) {
      window.location.replace(`#${page}`);
    } else {
      window.location.hash = page; 
    }
  };

  // ==========================================
  // ROUTE GUARDS: Prevent "Back Button" exploits
  // ==========================================
  useEffect(() => {
    const isRecruiterRoute = ["recruiter-options", "interviewer-dashboard"].includes(currentPage);
    const isCandidateRoute = ["setup", "interview"].includes(currentPage);
    const isSharedRoute = ["dashboard"].includes(currentPage);

    // If unauthenticated or accessing the wrong role's page, forcefully replace history and boot to landing
    if ((isRecruiterRoute && authRole !== "recruiter") || 
        (isCandidateRoute && authRole !== "candidate") ||
        (isSharedRoute && !authRole)) {
        navigate("landing", true); 
    }
  }, [currentPage, authRole]);

  // --- ROUTING LOGIC ---
  const handleLogin = (loggedInUsername) => {
    localStorage.setItem("authRole", authRole); 

    if (authRole === "recruiter") {
      setRecruiterUsername(loggedInUsername);
      localStorage.setItem("recruiterUsername", loggedInUsername);
      navigate("recruiter-options"); 
    } else {
      setCandidateUsername(loggedInUsername);
      localStorage.setItem("candidateUsername", loggedInUsername);
      navigate("setup");
    }
  };

  const handleLogout = () => {
    // 1. Clear States
    setRecruiterUsername("");
    setCandidateUsername("");
    setAuthRole(null);
    setInterviewFormat(null);
    
    // 2. Clear Local Storage
    localStorage.removeItem("recruiterUsername");
    localStorage.removeItem("candidateUsername");
    localStorage.removeItem("authRole");
    localStorage.removeItem("username"); 
    
    // 3. FORCE REPLACE ROUTE: They are logged out completely and cannot go backward
    navigate("landing", true);
  };

  return (
    <div className="app" style={{ display: 'block', minHeight: '100vh', padding: 0 }}>
      
      {/* 1. PUBLIC ROUTES */}
      {currentPage === "landing" && (
        <LandingPage 
          onStartCandidate={() => { setAuthRole("candidate"); navigate("auth"); }}
          onStartRecruiter={() => { setAuthRole("recruiter"); navigate("auth"); }}
        />
      )}

      {currentPage === "auth" && (
        <AuthPage 
          type={authRole} 
          onLogin={handleLogin} 
          onBack={handleLogout} 
        />
      )}

      {/* 2. SECURE RECRUITER FLOW */}
      {authRole === "recruiter" && currentPage === "recruiter-options" && (
        <RecruiterOptionsPage 
          onSelectOption={(format) => {
            setInterviewFormat(format); 
            navigate("interviewer-dashboard"); 
          }}
          onBack={handleLogout}
        />
      )}

      {authRole === "recruiter" && currentPage === "interviewer-dashboard" && (
        <InterviewerDashboard 
          username={recruiterUsername}
          format={interviewFormat} 
          onBack={handleLogout} // Hooked directly to the complete logout
          onViewReport={(fetchedReport) => {
            setReportData(fetchedReport);
            navigate("dashboard");
          }}
        />
      )}

      {/* 3. SECURE CANDIDATE FLOW */}
      {authRole === "candidate" && currentPage === "setup" && (
        <SetupPage 
          username={candidateUsername}
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

      {authRole === "candidate" && currentPage === "interview" && (
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

      {/* 4. SECURE SHARED DASHBOARD */}
      {authRole && currentPage === "dashboard" && (
        <DashboardPage 
          studentName={interviewData?.studentName || reportData?.candidate_name}
          loggedInUser={authRole === "recruiter" ? recruiterUsername : candidateUsername}
          report={reportData}
          onExit={() => {
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
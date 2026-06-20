import React, { useState, useEffect } from 'react';

// Import Pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import SetupPage from './pages/SetupPage';
import InterviewMonitor from './pages/InterviewMonitor';
import DashboardPage from './pages/DashboardPage';
import InterviewerDashboard from './pages/InterviewerDashboard';
import RecruiterOptionsPage from './pages/RecruiterOptionsPage';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  // Global App State
  const [currentPage, setCurrentPage] = useState("landing");
  const [authRole, setAuthRole] = useState(() => localStorage.getItem("authRole") || null);
  const [recruiterKey, setRecruiterKey] = useState(() => localStorage.getItem("recruiterKey") || "");
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("companyName") || "");
  
  // Separate Usernames
  const [recruiterUsername, setRecruiterUsername] = useState(() => localStorage.getItem("recruiterUsername") || "");
  const [candidateUsername, setCandidateUsername] = useState(() => localStorage.getItem("candidateUsername") || "");
  const [adminUsername, setAdminUsername] = useState(() => localStorage.getItem("adminUsername") || "");

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
    const isAdminRoute = ["admin-dashboard"].includes(currentPage);
    const isSharedRoute = ["dashboard"].includes(currentPage);

    // If unauthenticated or accessing the wrong role's page, forcefully replace history and boot to landing
    if ((isRecruiterRoute && authRole !== "recruiter") || 
        (isCandidateRoute && authRole !== "candidate") ||
        (isSharedRoute && !authRole)) {
        navigate("landing", true); 
    }
  }, [currentPage, authRole]);

  // --- ROUTING LOGIC ---
  const handleLogin = (data) => {
    // Extract username whether it's an old string format or the new object format
    const loggedInUsername = typeof data === 'string' ? data : data.username;
    
    localStorage.setItem("authRole", authRole); 

    if (authRole === "recruiter") {
      setRecruiterUsername(loggedInUsername);
      localStorage.setItem("recruiterUsername", loggedInUsername);
      
      // Save the Company Name and Recruiter Key to memory
      const rKey = data.recruiter_key || "";
      const cName = data.company_name || "Unknown Company";
      
      setRecruiterKey(rKey);
      setCompanyName(cName);
      localStorage.setItem("recruiterKey", rKey);
      localStorage.setItem("companyName", cName);
      
      navigate("interviewer-dashboard"); 
    } else if (authRole === "admin") {
      setAdminUsername(loggedInUsername);
      localStorage.setItem("adminUsername", loggedInUsername);
      navigate("admin-dashboard");
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
    setAdminUsername("");
    setAuthRole(null);
    setInterviewFormat(null);
    
    // 2. Clear Local Storage
    localStorage.removeItem("recruiterUsername");
    localStorage.removeItem("candidateUsername");
    localStorage.removeItem("adminUsername");
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
          onStartCandidate={() => { 
            setAuthRole("candidate"); 
            localStorage.setItem("authRole", "candidate"); 
            navigate("auth"); 
          }}
          onStartRecruiter={() => { 
            setAuthRole("recruiter"); 
            localStorage.setItem("authRole", "recruiter"); 
            navigate("auth"); 
          }}
          onStartAdmin={() => { 
            setAuthRole("admin"); 
            localStorage.setItem("authRole", "admin"); // <-- This ensures it doesn't refresh to Candidate!
            navigate("auth"); 
          }} 
        />
      )}

      {currentPage === "auth" && (
        <AuthPage 
          type={authRole} 
          onLogin={handleLogin} 
          onBack={handleLogout} 
        />
      )}

      {/* 2. SECURE ADMIN FLOW */}
      {authRole === "admin" && currentPage === "admin-dashboard" && (
        <AdminDashboard 
          username={adminUsername} 
          onBack={handleLogout}
          onViewReport={(fetchedReport) => {
            setReportData(fetchedReport);
            navigate("dashboard");
          }} 
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
          recruiterKey={recruiterKey} 
          companyName={companyName} 
          onBack={handleLogout}
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
          loggedInUser={authRole === "recruiter" ? recruiterUsername : (authRole === "admin" ? adminUsername : candidateUsername)}
          report={reportData}
          onExit={() => {
            if (authRole === "recruiter") {
              navigate("interviewer-dashboard");
            } else if (authRole === "admin") {
              navigate("admin-dashboard"); // Return admin to admin dashboard
            } else {
              navigate("setup");
            }
          }}
        />
      )}
    </div>
  );
}
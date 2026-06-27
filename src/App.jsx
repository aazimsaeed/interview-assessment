import React, { useState, useEffect } from 'react';
import { API_BASE } from './config';
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
  // ROUTING LOGIC
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

  const navigate = (page, replaceHistory = false) => {
    if (replaceHistory) {
      window.location.replace(`#${page}`);
    } else {
      window.location.hash = page; 
    }
  };

  useEffect(() => {
    const isRecruiterRoute = ["recruiter-options", "interviewer-dashboard"].includes(currentPage);
    const isCandidateRoute = ["setup", "interview"].includes(currentPage);
    const isAdminRoute = ["admin-dashboard"].includes(currentPage);
    const isSharedRoute = ["dashboard"].includes(currentPage);

    if ((isRecruiterRoute && authRole !== "recruiter") || 
        (isCandidateRoute && authRole !== "candidate") ||
        (isAdminRoute && authRole !== "admin") ||
        (isSharedRoute && !authRole)) {
        navigate("landing", true); 
    }
  }, [currentPage, authRole]);

  // --- HARDENED LOGIN ROUTER ---
  const handleLogin = (usernameData, roleOverride, rKeyParam, cNameParam) => {
    const loggedInUsername = typeof usernameData === 'string' ? usernameData : usernameData?.username;
    
    // Explicitly enforce the role passed from AuthPage to prevent state caching errors
    const finalRole = roleOverride || authRole;
    
    setAuthRole(finalRole);
    localStorage.setItem("authRole", finalRole); 

    if (finalRole === "admin") {
      setAdminUsername(loggedInUsername);
      localStorage.setItem("adminUsername", loggedInUsername);
      navigate("admin-dashboard");
      
    } else if (finalRole === "recruiter") {
      setRecruiterUsername(loggedInUsername);
      localStorage.setItem("recruiterUsername", loggedInUsername);
      
      const rKey = rKeyParam || (typeof usernameData === 'object' ? usernameData.recruiter_key : "");
      const cName = cNameParam || (typeof usernameData === 'object' ? usernameData.company_name : "Unknown Company");
      
      setRecruiterKey(rKey);
      setCompanyName(cName);
      localStorage.setItem("recruiterKey", rKey);
      localStorage.setItem("companyName", cName);
      
      navigate("interviewer-dashboard"); 
      
    } else {
      setCandidateUsername(loggedInUsername);
      localStorage.setItem("candidateUsername", loggedInUsername);
      navigate("setup");
    }
  };

  const handleLogout = () => {
    setRecruiterUsername("");
    setCandidateUsername("");
    setAdminUsername("");
    setAuthRole(null);
    setInterviewFormat(null);
    
    localStorage.clear(); // Complete security clear
    navigate("landing", true);
  };

  return (
    <div className="app" style={{ display: 'block', minHeight: '100vh', padding: 0 }}>
      
      {/* 1. PUBLIC ROUTES */}
      {currentPage === "landing" && (
        <LandingPage 
          onStartCandidate={() => { 
            setAuthRole("candidate"); localStorage.setItem("authRole", "candidate"); navigate("auth"); 
          }}
          onStartRecruiter={() => { 
            setAuthRole("recruiter"); localStorage.setItem("authRole", "recruiter"); navigate("auth"); 
          }}
          onStartAdmin={() => { 
            setAuthRole("admin"); localStorage.setItem("authRole", "admin"); navigate("auth"); 
          }} 
        />
      )}

      {currentPage === "auth" && (
        <AuthPage type={authRole} onLogin={handleLogin} onBack={handleLogout} />
      )}

      {/* 2. SECURE ADMIN FLOW */}
      {authRole === "admin" && currentPage === "admin-dashboard" && (
        <AdminDashboard 
          username={adminUsername} 
          onBack={handleLogout}
          onViewReport={(fetchedReport) => { setReportData(fetchedReport); navigate("dashboard"); }} 
        />
      )}

      {/* 3. SECURE RECRUITER FLOW */}
      {authRole === "recruiter" && currentPage === "recruiter-options" && (
        <RecruiterOptionsPage 
          onSelectOption={(format) => { setInterviewFormat(format); navigate("interviewer-dashboard"); }}
          onBack={handleLogout}
        />
      )}

      {authRole === "recruiter" && currentPage === "interviewer-dashboard" && (
        <InterviewerDashboard 
          username={recruiterUsername} recruiterKey={recruiterKey} companyName={companyName} 
          onBack={handleLogout} onViewReport={(fetchedReport) => { setReportData(fetchedReport); navigate("dashboard"); }} 
        />
      )}

      {/* 4. SECURE CANDIDATE FLOW */}
      {authRole === "candidate" && currentPage === "setup" && (
        <SetupPage 
          username={candidateUsername} onViewReport={(fetchedReport) => { setReportData(fetchedReport); navigate("dashboard"); }}
          onStart={(data) => { setInterviewData(data); navigate("interview"); }} onBack={handleLogout}
        />
      )}

      {authRole === "candidate" && currentPage === "interview" && (
        <div style={{ padding: '16px' }}>
            <InterviewMonitor 
              studentName={interviewData?.studentName} customQuestions={interviewData?.questions}
              onFinish={async (report) => {
                  if (interviewData?.id && report) {
                      try {
                          await fetch(`${API_BASE}/api/reports`, {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                  interview_id: interviewData.id, candidate_name: interviewData.studentName,
                                  duration: report.duration, metrics: report.metrics,
                                  report: { strengths: report.report?.strengths || [], weaknesses: report.report?.weaknesses || [], suggestions: report.report?.suggestions || [], timeline: report.timeline || [], snapshots: report.snapshots || [] }
                              })
                          });
                      } catch (err) { console.error("Failed to save report to DB", err); }
                  }
                  setReportData(report); navigate("dashboard");
              }}
              onExit={() => navigate("setup")}
            />
        </div>
      )}

      {/* 5. SECURE SHARED DASHBOARD */}
      {authRole && currentPage === "dashboard" && (
        <DashboardPage 
          studentName={interviewData?.studentName || reportData?.candidate_name}
          loggedInUser={authRole === "recruiter" ? recruiterUsername : (authRole === "admin" ? adminUsername : candidateUsername)}
          report={reportData}
          onExit={() => navigate(authRole === "recruiter" ? "interviewer-dashboard" : (authRole === "admin" ? "admin-dashboard" : "setup"))}
        />
      )}
    </div>
  );
}
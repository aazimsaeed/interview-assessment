import React, { useState } from 'react';
import emailjs from '@emailjs/browser'; // Imports browser-side email delivery

export default function AuthPage({ type, onLogin, onBack }) {
    const [isRegistering, setIsRegistering] = useState(false);
    
    // --- Standard Form Fields ---
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState(""); 
    
    // --- Admin Distinct Verification States ---
    const [adminEmail, setAdminEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [otpStep, setOtpStep] = useState(1); // 1 = "Verify", 2 = "Send OTP", 3 = Enter Code Page

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const API_BASE = "http://localhost:8000"; 

    // --- EMAILJS CONFIGURATION ---
    const EMAILJS_SERVICE_ID = "service_rvp9rub"; 
    const EMAILJS_TEMPLATE_ID = "template_d0bdb6h";
    const EMAILJS_PUBLIC_KEY = "z_z2F1e4quN7sEzkd";

    // STEP 1: Verify the Email address against Admin Authorization rules
    const handleAdminVerify = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admins/verify-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: adminEmail })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                // Catches mismatch errors and sets UI banner: "email address not authorized, please enter the valid email"
                throw new Error(data.detail || "Verification failed");
            }
            
            // Fires exact text: "authorization done successfully, otp will be sent to your email"
            alert(data.message);
            setOtpStep(2); // Updates button to "Send OTP" state
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // STEP 2: Request generated code block from backend and transmit via Browser SDK
    // STEP 2: Request generated code block from backend and transmit via Browser SDK
const handleAdminSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
        console.log("1. Requesting OTP from backend for:", adminEmail);
        const response = await fetch(`${API_BASE}/api/admins/request-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminEmail })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Failed to generate OTP token from backend.");

        if (data.generated_otp) {
            console.log("2. Backend generated OTP successfully. Attempting to send EmailJS...");
            const templateParams = {
                to_email: adminEmail,
                otp_code: data.generated_otp 
            };

            // Transmit through EmailJS
            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_TEMPLATE_ID,
                templateParams,
                EMAILJS_PUBLIC_KEY
            );
            console.log("3. EmailJS sent successfully!");
        }
        
        alert("OTP dispatch secure execution completed. Check your email inbox.");
        setOtpStep(3); // Navigate to step 3
    } catch (err) {
        console.error("🔥 ERROR DURING STEP 2:", err);
        setError(err.message || "An error occurred during dispatch.");
    } finally {
        setLoading(false);
    }
};

    // STEP 3: Validate the User Entered OTP token for portal authorization
    const handleAdminLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admins/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: adminEmail, otp })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Authentication Failed. Invalid Pin.");
            
            onLogin(data.username);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const endpoint = isRegistering 
            ? `${API_BASE}/api/${type}s/register` 
            : `${API_BASE}/api/${type}s/login`;

        const payload = { username, password };
        if (isRegistering && type === "candidate") {
            payload.email = email;
            payload.phone = phone;
            payload.role = role;
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Authentication failed");

            if (isRegistering) {
                alert("Registration successful! Please log in.");
                setIsRegistering(false);
                setPassword("");
            } else {
                onLogin(data.username);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const titleType = type === "recruiter" ? "Recruiter" : "Candidate";

    // ==========================================
    // RENDER ADMIN 3-STEP FLOW INTERFACE
    // ==========================================
    if (type === "admin") {
        return (
            <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="card" style={{ width: '400px', padding: '30px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>🛡️ Admin Portal</h2>
                        <button type="button" className="btn" onClick={onBack} style={{ padding: '5px 10px' }}>Cancel</button>
                    </div>
                    
                    <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '13px' }}>
                        Multi-Factor authorized system management control point.
                    </p>
                    
                    {error && (
                        <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px', textAlign: 'left', fontSize: '13px' }}>
                            {error}
                        </div>
                    )}
                    
                    {/* STEP 1: Verify Button State Display */}
                    {otpStep === 1 && (
                        <form onSubmit={handleAdminVerify} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input 
                                type="email" 
                                required 
                                className="input" 
                                placeholder="Enter Authorized Admin Email" 
                                value={adminEmail} 
                                onChange={e => setAdminEmail(e.target.value)} 
                            />
                            <button type="submit" className="btn primary" disabled={loading} style={{ padding: '12px' }}>
                                {loading ? "Verifying..." : "Verify"}
                            </button>
                        </form>
                    )}

                    {/* STEP 2: Send OTP Button State Display */}
                    {otpStep === 2 && (
                        <form onSubmit={handleAdminSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input 
                                type="email" 
                                disabled 
                                className="input" 
                                value={adminEmail} 
                                style={{ opacity: 0.6, cursor: 'not-allowed' }}
                            />
                            <button type="submit" className="btn primary" disabled={loading} style={{ padding: '12px', background: '#38bdf8', borderColor: '#0284c7', color: '#fff' }}>
                                {loading ? "Transmitting..." : "Send OTP"}
                            </button>
                            <button type="button" className="btn" onClick={() => setOtpStep(1)} style={{ fontSize: '12px', background: 'transparent', border: 'none' }}>
                                ← Change Account Email
                            </button>
                        </form>
                    )}

                    {/* STEP 3: Navigate to enter the OTP Validation Input Fields */}
                    {otpStep === 3 && (
                        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <p style={{ margin: 0, color: '#38bdf8', fontSize: '12px' }}>A text key was sent to: {adminEmail}</p>
                            <input 
                                type="text" 
                                required 
                                className="input" 
                                placeholder="Enter 6-digit OTP" 
                                value={otp} 
                                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} 
                                maxLength={6} 
                                style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '1.4rem', fontWeight: 'bold' }} 
                            />
                            <button type="submit" className="btn primary" disabled={loading || otp.length !== 6} style={{ padding: '12px', background: '#22c55e', color: '#fff', borderColor: '#16a34a' }}>
                                {loading ? "Authorizing..." : "Login"}
                            </button>
                            <button type="button" className="btn" onClick={() => setOtpStep(2)} style={{ fontSize: '12px', background: 'transparent', border: 'none' }}>
                                ← Trigger Code Resend Request
                            </button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // ==========================================
    // RENDER STANDARD SYSTEM FORMS
    // ==========================================
    return (
        <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <div className="card" style={{ width: '400px', padding: '30px' }}>
                <button type="button" className="btn" onClick={onBack} style={{ marginBottom: '20px' }}>← Back to Home</button>
                <h2>{isRegistering ? `Register as ${titleType}` : `${titleType} Login`}</h2>
                
                {error && <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px' }}>{error}</div>}
                
                <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Username</label>
                        <input type="text" required className="input" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                    
                    {isRegistering && type === "candidate" && (
                        <>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Target Role</label>
                                <input type="text" required className="input" placeholder="e.g. Frontend Developer" value={role} onChange={e => setRole(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Email</label>
                                <input type="email" required className="input" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Phone Number</label>
                                <input type="tel" required className="input" value={phone} onChange={e => setPhone(e.target.value)} />
                            </div>
                        </>
                    )}

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Password</label>
                        <input type="password" required className="input" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>

                    <button type="submit" className="btn primary" disabled={loading} style={{ padding: '12px', marginTop: '10px' }}>
                        {loading ? "Processing..." : (isRegistering ? "Register Account" : "Log In")}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
                    {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
                    <span onClick={() => { setIsRegistering(!isRegistering); setError(""); }} style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}>
                        {isRegistering ? "Log in here" : "Register here"}
                    </span>
                </p>
            </div>
        </div>
    );
}
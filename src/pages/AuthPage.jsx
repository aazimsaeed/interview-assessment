import React, { useState } from 'react';
import emailjs from '@emailjs/browser';

export default function AuthPage({ type, onLogin, onBack }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    
    // --- Standard Form Fields ---
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [companyName, setCompanyName] = useState("");
    
    // --- UI State ---
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // --- Forgot Password State ---
    const [resetStep, setResetStep] = useState(1);
    const [resetOtp, setResetOtp] = useState("");

    // --- Admin Distinct Verification States ---
    const [adminEmail, setAdminEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [otpStep, setOtpStep] = useState(1); // 1 = Verify, 2 = Send, 3 = Enter

    const API_BASE = "http://localhost:8000"; 

    // --- EMAILJS CONFIGURATION ---
    // (Ensure you put your actual keys here)
    const EMAILJS_SERVICE_ID = "service_rvp9rub"; 
    const EMAILJS_TEMPLATE_ID = "template_d0bdb6h";
    const EMAILJS_PUBLIC_KEY = "z_z2F1e4quN7sEzkd";

    // ==========================================
    // ADMIN 3-STEP VERIFICATION LOGIC
    // ==========================================
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
            if (!response.ok) throw new Error(data.detail || "Verification failed");
            
            alert(data.message);
            setOtpStep(2); 
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    };

    const handleAdminSendOtp = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admins/request-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: adminEmail })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Failed to generate OTP token.");

            if (data.generated_otp) {
                const templateParams = {
                    to_email: adminEmail,
                    otp_code: data.generated_otp 
                };
                
                // --- NEW SAFETY NET FOR EMAILJS ---
                try {
                    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
                    alert("OTP dispatch secure execution completed. Check your email inbox.");
                } catch (emailErr) {
                    console.error("EmailJS Error:", emailErr);
                    alert(`⚠️ EmailJS is not configured correctly. For testing purposes, your OTP is: ${data.generated_otp}`);
                }
            }
            
            // This will now ALWAYS trigger, moving you to step 3!
            setOtpStep(3); 
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    };

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
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    };

    // ==========================================
    // FORGOT PASSWORD LOGIC
    // ==========================================
    const handleForgotPasswordRequest = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/forgot-password/request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: type, email })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);

            if (data.generated_otp) {
                await emailjs.send(
                    EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID,
                    { to_email: email, otp_code: data.generated_otp },
                    EMAILJS_PUBLIC_KEY
                );
            }
            alert("Password reset OTP sent to your email.");
            setResetStep(2);
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    };

    const handlePasswordResetSubmit = async (e) => {
        e.preventDefault();
        setError("");
        if (password !== confirmPassword) return setError("Passwords do not match!");
        
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/forgot-password/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: type, email, otp: resetOtp, new_password: password })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail);
            
            alert("Password successfully reset! You can now log in.");
            setIsForgotPassword(false);
            setResetStep(1);
            setPassword("");
            setConfirmPassword("");
            setResetOtp("");
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    };

    // ==========================================
    // LOGIN & REGISTER LOGIC
    // ==========================================
    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (isRegistering && password !== confirmPassword) {
            return setError("Passwords do not match!");
        }

        setLoading(true);
        const endpoint = isRegistering ? `${API_BASE}/api/${type}s/register` : `${API_BASE}/api/${type}s/login`;

        const payload = { username, password };
        
        if (isRegistering) {
            payload.email = email;
            if (type === "candidate") {
                payload.phone = phone;
            } else if (type === "recruiter") {
                payload.company_name = companyName;
            }
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Authentication failed");

            // --- APPLICATION INTERCEPTOR ---
            const pendingAdStr = localStorage.getItem("pendingApplication");
            if (type === "candidate" && pendingAdStr) {
                const ad = JSON.parse(pendingAdStr);
                try {
                    await fetch(`${API_BASE}/api/applications`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            candidate_username: isRegistering ? username : data.username,
                            ad_id: ad.id,
                            recruiter_key: ad.recruiter_key
                        })
                    });
                    alert(`Application sent to ${ad.company_name}! The recruiter will review it shortly.`);
                } catch (applyErr) {
                    console.error("Failed to apply", applyErr);
                } finally {
                    localStorage.removeItem("pendingApplication");
                }
            }
            // ------------------------------------

            if (isRegistering) {
                alert("Registration successful! Please log in.");
                setIsRegistering(false);
                setPassword("");
                setConfirmPassword("");
            } else {
                onLogin(data);
            }
        } catch (err) { setError(err.message); } 
        finally { setLoading(false); }
    };

    const titleType = type === "recruiter" ? "Recruiter" : "Candidate";

    // ==========================================
    // 1. RENDER ADMIN PORTAL UI
    // ==========================================
    if (type === "admin") {
        return (
            <div className="shell flex-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="card" style={{ width: '400px', padding: '30px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ margin: 0 }}>🛡️ Admin Portal</h2>
                        <button type="button" className="btn" onClick={onBack} style={{ padding: '5px 10px' }}>Cancel</button>
                    </div>
                    
                    <p style={{ color: '#94a3b8', marginBottom: '20px', fontSize: '13px' }}>
                        Multi-Factor authorized system management control point.
                    </p>
                    
                    {error && <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px', textAlign: 'left', fontSize: '13px' }}>{error}</div>}
                    
                    {otpStep === 1 && (
                        <form onSubmit={handleAdminVerify} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="email" required className="input" placeholder="Enter Authorized Admin Email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} />
                            <button type="submit" className="btn primary" disabled={loading} style={{ padding: '12px' }}>{loading ? "Verifying..." : "Verify"}</button>
                        </form>
                    )}

                    {otpStep === 2 && (
                        <form onSubmit={handleAdminSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="email" disabled className="input" value={adminEmail} style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                            <button type="submit" className="btn primary" disabled={loading} style={{ padding: '12px', background: '#38bdf8', borderColor: '#0284c7', color: '#fff' }}>
                                {loading ? "Transmitting..." : "Send OTP"}
                            </button>
                            <button type="button" className="btn" onClick={() => setOtpStep(1)} style={{ fontSize: '12px', background: 'transparent', border: 'none' }}>← Change Account Email</button>
                        </form>
                    )}

                    {otpStep === 3 && (
                        <form onSubmit={handleAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <p style={{ margin: 0, color: '#38bdf8', fontSize: '12px' }}>A text key was sent to: {adminEmail}</p>
                            <input type="text" required className="input" placeholder="Enter 6-digit OTP" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '1.4rem', fontWeight: 'bold' }} />
                            <button type="submit" className="btn primary" disabled={loading || otp.length !== 6} style={{ padding: '12px', background: '#22c55e', color: '#fff', borderColor: '#16a34a' }}>
                                {loading ? "Authorizing..." : "Login"}
                            </button>
                            <button type="button" className="btn" onClick={() => setOtpStep(2)} style={{ fontSize: '12px', background: 'transparent', border: 'none' }}>← Trigger Code Resend Request</button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // ==========================================
    // 2. RENDER FORGOT PASSWORD UI
    // ==========================================
    if (isForgotPassword) {
        return (
            <div className="shell flex-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="card" style={{ width: '400px', padding: '30px' }}>
                    <button type="button" className="btn" onClick={() => setIsForgotPassword(false)} style={{ marginBottom: '20px' }}>← Back to Login</button>
                    <h2>Reset {titleType} Password</h2>
                    {error && <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px' }}>{error}</div>}
                    
                    {resetStep === 1 ? (
                        <form onSubmit={handleForgotPasswordRequest} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="email" required className="input" placeholder="Enter your registered email" value={email} onChange={e => setEmail(e.target.value)} />
                            <button type="submit" className="btn primary" disabled={loading}>{loading ? "Sending..." : "Send Reset OTP"}</button>
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <input type="text" required className="input" placeholder="Enter 6-digit OTP" maxLength={6} value={resetOtp} onChange={e => setResetOtp(e.target.value.replace(/\D/g, ''))} style={{ letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }} />
                            
                            <div style={{ position: 'relative' }}>
                                <input type={showPassword ? "text" : "password"} required className="input" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%' }} />
                                <span onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '15px', top: '12px', cursor: 'pointer', userSelect: 'none' }}>{showPassword ? "🙈" : "👁️"}</span>
                            </div>
                            
                            <div style={{ position: 'relative' }}>
                                <input type={showConfirmPassword ? "text" : "password"} required className="input" placeholder="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%' }} />
                                <span onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '15px', top: '12px', cursor: 'pointer', userSelect: 'none' }}>{showConfirmPassword ? "🙈" : "👁️"}</span>
                            </div>
                            
                            <button type="submit" className="btn primary" disabled={loading}>{loading ? "Resetting..." : "Reset Password"}</button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // ==========================================
    // 3. RENDER STANDARD AUTH UI
    // ==========================================
    return (
        <div className="shell flex-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
             <div className="card" style={{ width: '450px', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
                <button type="button" className="btn" onClick={onBack} style={{ marginBottom: '20px' }}>← Back to Home</button>
                <h2>{isRegistering ? `Register as ${titleType}` : `${titleType} Login`}</h2>
                
                {error && <div style={{ color: '#ef4444', marginBottom: '15px', padding: '10px', background: '#451a1e', borderRadius: '6px' }}>{error}</div>}
                
                <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Username</label>
                        <input type="text" required className="input" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                    
                    {isRegistering && type === "recruiter" && (
                        <>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Company Name</label>
                                <input type="text" required className="input" placeholder="e.g. Acme Corp" value={companyName} onChange={e => setCompanyName(e.target.value)} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Email Address</label>
                                <input type="email" required className="input" placeholder="work@company.com" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                        </>
                    )}

                    {isRegistering && type === "candidate" && (
                        <>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Email Address</label>
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
                        <div style={{ position: 'relative' }}>
                            <input type={showPassword ? "text" : "password"} required className="input" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%' }} />
                            <span onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '15px', top: '12px', cursor: 'pointer', userSelect: 'none' }}>
                                {showPassword ? "🙈" : "👁️"}
                            </span>
                        </div>
                    </div>

                    {isRegistering && (
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Confirm Password</label>
                            <div style={{ position: 'relative' }}>
                                <input type={showConfirmPassword ? "text" : "password"} required className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%' }} />
                                <span onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '15px', top: '12px', cursor: 'pointer', userSelect: 'none' }}>
                                    {showConfirmPassword ? "🙈" : "👁️"}
                                </span>
                            </div>
                        </div>
                    )}

                    <button type="submit" className="btn primary" disabled={loading} style={{ padding: '12px', marginTop: '10px' }}>
                        {loading ? "Processing..." : (isRegistering ? "Register Account" : "Log In")}
                    </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                        {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
                        <span onClick={() => { setIsRegistering(!isRegistering); setError(""); }} style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}>
                            {isRegistering ? "Log in here" : "Register here"}
                        </span>
                    </p>
                    
                    {!isRegistering && (
                        <span onClick={() => { setIsForgotPassword(true); setError(""); }} style={{ color: '#94a3b8', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline' }}>
                            Forgot Password?
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
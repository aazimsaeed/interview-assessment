import React, { useState } from 'react';

export default function AuthPage({ type, onLogin, onBack }) {
    const [isRegistering, setIsRegistering] = useState(false);
    
    // Form fields
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [role, setRole] = useState(""); // <-- Added role state
    
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const API_BASE = "http://localhost:8000"; 
    
    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const endpoint = isRegistering 
            ? `${API_BASE}/api/${type}s/register` 
            : `${API_BASE}/api/${type}s/login`;

        // Include candidate-specific fields on registration
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
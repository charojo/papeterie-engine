import { useState } from 'react';
import { Icon } from './Icon';
import { toast } from 'sonner';

export function LoginView({ onLogin }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
        const body = isRegistering
            ? { username, email, password }
            : { email, password };

        try {
            const res = await fetch(`http://localhost:8000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || 'Authentication failed');
            }

            if (isRegistering) {
                toast.success('Registration successful! Please login.');
                setIsRegistering(false);
            } else {
                toast.success('Welcome back!');
                onLogin(data);
            }
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: 'radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%)',
            padding: '24px',
            overflow: 'hidden'
        }}>
            <div className="login-card glass" style={{
                width: '100%',
                maxWidth: '900px',
                minHeight: '520px',
                borderRadius: '32px',
                display: 'flex',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.05)',
                overflow: 'hidden',
                animation: 'fadeIn 0.6s ease-out'
            }}>
                {/* Left Side: Local Theater (Quick Entry) */}
                <div style={{
                    flex: '1',
                    padding: '48px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    gap: '24px'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '8px'
                    }}>
                        <Icon name="scenes" size={42} color="var(--color-text-muted)" />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 12px', color: 'var(--color-text-main)' }}>Local Theater</h2>
                        <p style={{ opacity: 0.6, fontSize: '15px', lineHeight: '1.6', maxWidth: '300px' }}>
                            Work offline. Your assets stay safely stored on your machine in the local workspace.
                        </p>
                    </div>
                    <button
                        className="btn btn-secondary"
                        onClick={() => onLogin({ user: { username: 'Guest' }, access_token: 'default', type: 'local' })}
                        style={{
                            height: '56px',
                            minWidth: '220px',
                            fontSize: '16px',
                            fontWeight: '600',
                            marginTop: '12px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px'
                        }}
                    >
                        Enter Local Theater
                    </button>
                </div>

                {/* Right Side: Cloud Theater (Login/Register) */}
                <div style={{
                    flex: '1.2',
                    padding: '48px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '24px'
                }}>
                    <div>
                        <h2 style={{ fontSize: '28px', fontWeight: '800', margin: '0 0 12px' }}>
                            {isRegistering ? 'New Playwright' : 'Cloud Theater'}
                        </h2>
                        <p style={{ opacity: 0.6, fontSize: '15px' }}>
                            {isRegistering ? 'Create an account to sync your work.' : 'Sign in to access your remote assets and collaborate.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {isRegistering && (
                            <div style={{ animation: 'slideDown 0.3s ease-out' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '8px' }}>USERNAME</label>
                                <input
                                    className="input"
                                    placeholder="The Playwright"
                                    value={username}
                                    style={{ height: '48px', borderRadius: '12px' }}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '8px' }}>EMAIL ADDRESS</label>
                            <input
                                type="email"
                                className="input"
                                placeholder="curtain@call.com"
                                value={email}
                                style={{ height: '48px', borderRadius: '12px' }}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', opacity: 0.5, marginBottom: '8px' }}>PASSWORD</label>
                            <input
                                type="password"
                                className="input"
                                placeholder="••••••••"
                                value={password}
                                style={{ height: '48px', borderRadius: '12px' }}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading} style={{
                            marginTop: '12px',
                            height: '56px',
                            fontSize: '16px',
                            fontWeight: '600',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            boxShadow: '0 10px 20px rgba(var(--color-primary-rgb), 0.2)'
                        }}>
                            {loading ? <div className="animate-spin"><Icon name="generate" size={20} /></div> : (isRegistering ? 'Create Account' : 'Sign In')}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                        <span style={{ fontSize: '14px', opacity: 0.6 }}>
                            {isRegistering ? 'Already have an account?' : "Don't have an account?"}
                        </span>
                        <button
                            className="btn-text"
                            onClick={() => setIsRegistering(!isRegistering)}
                            style={{
                                marginLeft: '8px',
                                color: 'var(--color-primary)',
                                fontWeight: '700',
                                fontSize: '14px',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '8px',
                                transition: 'all 0.2s',
                                textDecoration: 'none'
                            }}
                            onMouseOver={(e) => e.target.style.background = 'rgba(var(--color-primary-rgb), 0.1)'}
                            onMouseOut={(e) => e.target.style.background = 'transparent'}
                        >
                            {isRegistering ? 'Sign In' : 'Sign Up'}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .btn-text:hover {
                    opacity: 0.8;
                }
            `}</style>
        </div>
    );
}

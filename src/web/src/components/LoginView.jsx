import { useState } from 'react';
import { Icon } from './Icon';
import { toast } from 'sonner';
import { API_BASE } from '../config';

export function LoginView({ onLogin }) {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const endpoint = isRegistering ? '/auth/register' : '/auth/login';
        const body = isRegistering
            ? { username, email, password }
            : { email, password };

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
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
        <div className="login-container flex items-center justify-center h-screen bg-base p-6 overflow-hidden">
            <div className="login-card glass w-full max-w-900 min-h-520 rounded-3xl flex shadow-xl border-muted overflow-hidden" style={{ animation: 'fadeIn 0.6s ease-out' }}>
                {/* Left Side: Local Theater (Quick Entry) */}
                <div className="flex-1 p-10 flex flex-col justify-center items-center text-center bg-surface border-r-muted gap-6">
                    <div className="w-80 h-80 bg-elevated rounded-2xl flex items-center justify-center mb-2">
                        <Icon name="scenes" size={42} color="var(--color-text-muted)" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold mb-3 text-main">Local Theater</h2>
                        <p className="opacity-60 text-sm lh-relaxed max-w-300">
                            Work offline. Your assets stay safely stored on your machine in the local workspace.
                        </p>
                    </div>
                    <button
                        className="btn btn-secondary h-14 min-w-220 text-md font-bold mt-3 bg-elevated border-muted rounded-xl"
                        onClick={() => onLogin({ user: { username: 'Guest' }, access_token: 'default', type: 'local' })}
                    >
                        Enter Local Theater
                    </button>
                </div>

                {/* Right Side: Cloud Theater (Login/Register) */}
                <div className="flex-1-2 login-right-pane flex flex-col justify-center gap-6">
                    <div>
                        <h2 className="text-2xl font-bold mb-3">
                            {isRegistering ? 'New Playwright' : 'Cloud Theater'}
                        </h2>
                        <p className="opacity-60 text-sm">
                            {isRegistering ? 'Create an account to sync your work.' : 'Sign in to access your remote assets and collaborate.'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {isRegistering && (
                            <div style={{ animation: 'slideDown 0.3s ease-out' }}>
                                <label className="block text-xs font-bold tracking-widest opacity-50 mb-2">USERNAME</label>
                                <input
                                    className="input h-12 rounded-lg"
                                    placeholder="The Playwright"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold tracking-widest opacity-50 mb-2">EMAIL ADDRESS</label>
                            <input
                                type="email"
                                className="input h-12 rounded-lg"
                                placeholder="curtain@call.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold tracking-widest opacity-50 mb-2">PASSWORD</label>
                            <input
                                type="password"
                                className="input h-12 rounded-lg"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn btn-primary mt-3 h-14 text-md font-bold rounded-xl flex items-center justify-center gap-3 shadow-primary" disabled={loading}>
                            {loading ? <div className="animate-spin"><Icon name="generate" size={20} /></div> : (isRegistering ? 'Create Account' : 'Sign In')}
                        </button>
                    </form>

                    <div className="text-center mt-2">
                        <span className="text-sm opacity-60">
                            {isRegistering ? 'Already have an account?' : "Don't have an account?"}
                        </span>
                        <button
                            className="btn-text"
                            onClick={() => setIsRegistering(!isRegistering)}
                            style={{
                                marginLeft: '8px',
                                color: 'var(--color-primary)',
                                fontWeight: '700',
                                fontSize: '0.875rem',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: '8px',
                                transition: 'all 0.2s',
                                textDecoration: 'none'
                            }}
                            onMouseOver={(e) => e.target.style.background = 'var(--color-primary-subtle)'}
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
                .login-right-pane {
                    padding: 5rem; /* Increased from p-10 (2.5rem) to reduce crowding */
                }
            `}</style>
        </div>
    );
}

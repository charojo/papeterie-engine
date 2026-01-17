import { useState } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { toast } from 'sonner';
import { API_BASE } from '../config';
import './LoginView.css';

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
        <div className="login-container">
            <div className="login-card glass">
                {/* Left Side: Local Theater (Quick Entry) */}
                <div className="login-left-pane">
                    <div className="login-left-bg-gradient"></div>

                    <div className="login-left-content">
                        <div className="login-app-icon-wrapper">
                            <Icon name="scenes" size={32} color="var(--color-bg-base)" />
                        </div>

                        <div>
                            <h2 className="login-local-theater-title">Local Theater</h2>
                            <p className="login-local-theater-desc">
                                The professional workspace.
                                <br /><span className="login-local-theater-sub">Work offline with local assets.</span>
                            </p>
                        </div>

                        <Button
                            variant="primary"
                            className="login-local-enter-btn w-90p h-11 rounded-12"
                            onClick={() => onLogin({ user: { username: 'Guest' }, access_token: 'default', type: 'local' })}
                        >
                            Enter Local Theater
                        </Button>
                    </div>
                </div>

                <div className="vertical-divider opacity-20"></div>

                {/* Right Side: Cloud Theater (Login/Register) */}
                <div className="login-right-pane">
                    <div className="login-right-content">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold mb-2 tracking-tight">
                                {isRegistering ? 'New Playwright' : 'Cloud Theater'}
                            </h2>
                            <p className="text-muted text-sm opacity-60">
                                {isRegistering ? 'Sync across your devices.' : 'Login to access project assets.'}
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="login-form-container">
                            <div className="login-form-wrapper">
                                {isRegistering && (
                                    <div className="login-input-wrapper">
                                        <label className="label-premium">Username</label>
                                        <input
                                            className="input login-input"
                                            placeholder="The Playwright"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            required
                                        />
                                    </div>
                                )}
                                <div className="login-field-group">
                                    <label className="label-premium">Email Address</label>
                                    <input
                                        type="email"
                                        className="input login-input"
                                        placeholder="curtain@call.com"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="login-field-group">
                                    <div className="login-password-header">
                                        <label className="label-premium m-0">Password</label>
                                        {!isRegistering && (
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                type="button"
                                                className="login-forgot-btn"
                                            >
                                                Forgot?
                                            </Button>
                                        )}
                                    </div>
                                    <input
                                        type="password"
                                        className="input login-input"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    variant="secondary"
                                    className="login-submit-btn w-full h-10 rounded-12"
                                    loading={loading}
                                    icon="login"
                                >
                                    {isRegistering ? 'Create Account' : 'Sign In'}
                                </Button>
                            </div>
                        </form>

                        <div className="login-toggle-container">
                            <span className="login-toggle-text">
                                {isRegistering ? 'Cast member?' : "New here?"}
                            </span>
                            <Button
                                variant="ghost"
                                size="xs"
                                className="login-toggle-btn ml-1"
                                onClick={() => setIsRegistering(!isRegistering)}
                            >
                                {isRegistering ? 'Sign In' : 'Sign Up'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

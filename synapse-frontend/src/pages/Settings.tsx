import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ArrowLeft,
    Loader2,
    Shield,
    Cloud,
    HardDrive,
    Check,
    X,
    RefreshCw,
    Download,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SystemStatus {
    embedding_service: {
        current_provider: string;
        privacy_mode: boolean;
        openai: {
            configured: boolean;
            model: string;
        };
        ollama: {
            available: boolean;
            base_url: string;
            model: string;
            available_models: string[];
        };
    };
    vector_store: {
        backend: string;
        available: boolean;
        count?: number;
    };
    privacy_mode: boolean;
}

interface OllamaStatus {
    available: boolean;
    base_url: string;
    current_model: string;
    available_models: string[];
}

export default function Settings() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<SystemStatus | null>(null);
    const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
    const [privacyMode, setPrivacyMode] = useState(false);
    const [pullingModel, setPullingModel] = useState(false);
    const [testingOllama, setTestingOllama] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Profile states
    const [user, setUser] = useState<{ id: string; name: string; email: string; avatar_url?: string } | null>(null);
    const [profileName, setProfileName] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [changingPassword, setChangingPassword] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const getAuthHeaders = () => {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    const fetchStatus = async () => {
        try {
            const [statusRes, ollamaRes, userRes] = await Promise.all([
                fetch(`${API_BASE}/api/settings/status`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE}/api/settings/ollama/status`, { headers: getAuthHeaders() }),
                fetch(`${API_BASE}/api/auth/me`, { headers: getAuthHeaders() }),
            ]);

            if (statusRes.ok) {
                const data = await statusRes.json();
                setStatus(data);
                setPrivacyMode(data.privacy_mode);
            }

            if (ollamaRes.ok) {
                const data = await ollamaRes.json();
                setOllamaStatus(data);
            }

            if (userRes.ok) {
                const userData = await userRes.json();
                setUser(userData);
                setProfileName(userData.name);
            }
        } catch (err) {
            console.error('Failed to fetch status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            navigate('/login');
            return;
        }
        fetchStatus();
    }, [navigate]);

    const handleUpdateProfile = async () => {
        if (!profileName.trim()) return;
        setSavingProfile(true);
        setProfileMessage(null);
        try {
            const response = await fetch(`${API_BASE}/api/auth/me`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name: profileName }),
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data);
                setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
            } else {
                const error = await response.json();
                setProfileMessage({ type: 'error', text: error.detail || 'Failed to update profile' });
            }
        } catch {
            setProfileMessage({ type: 'error', text: 'Failed to update profile' });
        } finally {
            setSavingProfile(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword) return;
        setChangingPassword(true);
        setProfileMessage(null);
        try {
            const response = await fetch(`${API_BASE}/api/auth/password`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            });
            if (response.ok) {
                setCurrentPassword('');
                setNewPassword('');
                setProfileMessage({ type: 'success', text: 'Password changed successfully!' });
            } else {
                const error = await response.json();
                setProfileMessage({ type: 'error', text: error.detail || 'Failed to change password' });
            }
        } catch {
            setProfileMessage({ type: 'error', text: 'Failed to change password' });
        } finally {
            setChangingPassword(false);
        }
    };

    const togglePrivacyMode = async () => {
        try {
            const endpoint = privacyMode
                ? `${API_BASE}/api/settings/privacy-mode/disable`
                : `${API_BASE}/api/settings/privacy-mode/enable`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: getAuthHeaders(),
            });

            if (response.ok) {
                const data = await response.json();
                setPrivacyMode(data.privacy_mode);
                await fetchStatus();
            } else {
                const error = await response.json();
                alert(error.detail || 'Failed to toggle privacy mode');
            }
        } catch (err) {
            console.error('Failed to toggle privacy mode');
        }
    };

    const pullModel = async (model: string) => {
        setPullingModel(true);
        try {
            const response = await fetch(`${API_BASE}/api/settings/ollama/pull`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ model }),
            });

            if (response.ok) {
                alert('Model pull started. This may take several minutes.');
            }
        } catch (err) {
            console.error('Failed to pull model');
        } finally {
            setPullingModel(false);
        }
    };

    const testOllama = async () => {
        setTestingOllama(true);
        setTestResult(null);
        try {
            const response = await fetch(`${API_BASE}/api/settings/ollama/test`, {
                method: 'POST',
                headers: getAuthHeaders(),
            });

            if (response.ok) {
                const data = await response.json();
                setTestResult({
                    success: true,
                    message: `Success! Model: ${data.model}, Dimensions: ${data.dimensions}`,
                });
            } else {
                const error = await response.json();
                setTestResult({
                    success: false,
                    message: error.detail || 'Test failed',
                });
            }
        } catch (err) {
            setTestResult({
                success: false,
                message: 'Connection failed',
            });
        } finally {
            setTestingOllama(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-surface">
                <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h1 className="text-lg font-semibold">Settings</h1>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-6 py-8">
                {/* Profile Section */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h2 className="text-lg font-medium mb-4">Profile</h2>

                    {profileMessage && (
                        <div className={`mb-4 p-3 rounded-lg text-sm ${profileMessage.type === 'success'
                                ? 'bg-success/10 text-success'
                                : 'bg-destructive/10 text-destructive'
                            }`}>
                            {profileMessage.text}
                        </div>
                    )}

                    <div className="p-4 rounded-lg border border-border bg-surface space-y-4">
                        <div className="flex items-center gap-4 pb-4 border-b border-border">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-lg font-medium">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                                <div className="font-medium">{user?.name}</div>
                                <div className="text-sm text-muted-foreground">{user?.email}</div>
                            </div>
                        </div>

                        <div>
                            <Label className="text-sm mb-2 block">Display Name</Label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                                />
                                <Button
                                    size="sm"
                                    onClick={handleUpdateProfile}
                                    disabled={savingProfile || profileName === user?.name}
                                >
                                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border">
                            <Label className="text-sm mb-2 block">Change Password</Label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    placeholder="Current password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                                />
                                <input
                                    type="password"
                                    placeholder="New password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
                                />
                                <Button
                                    size="sm"
                                    onClick={handleChangePassword}
                                    disabled={changingPassword || !currentPassword || !newPassword}
                                >
                                    {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* Privacy Mode Section */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-medium">Privacy Mode</h2>
                    </div>

                    <div className="p-4 rounded-lg border border-border bg-surface">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <div className="font-medium mb-1">Enable Privacy Mode</div>
                                <p className="text-sm text-muted-foreground">
                                    All processing happens locally. No data sent to cloud services.
                                </p>
                            </div>
                            <Switch
                                checked={privacyMode}
                                onCheckedChange={togglePrivacyMode}
                            />
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                            <div className={`flex items-center gap-2 ${privacyMode ? 'text-success' : 'text-muted-foreground'}`}>
                                <HardDrive className="w-4 h-4" />
                                Local Processing
                                {privacyMode && <Check className="w-3 h-3" />}
                            </div>
                            <div className={`flex items-center gap-2 ${!privacyMode ? 'text-primary' : 'text-muted-foreground'}`}>
                                <Cloud className="w-4 h-4" />
                                Cloud Services
                                {!privacyMode && <Check className="w-3 h-3" />}
                            </div>
                        </div>
                    </div>
                </motion.section>

                {/* Embedding Provider Section */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="mb-8"
                >
                    <h2 className="text-lg font-medium mb-4">Embedding Provider</h2>

                    <div className="space-y-4">
                        {/* Current Status */}
                        <div className="p-4 rounded-lg border border-border bg-surface">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <div className="text-muted-foreground mb-1">Current Provider</div>
                                    <div className="font-medium capitalize">
                                        {status?.embedding_service.current_provider || 'Unknown'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-1">OpenAI</div>
                                    <div className="flex items-center gap-2">
                                        {status?.embedding_service.openai.configured ? (
                                            <>
                                                <Check className="w-4 h-4 text-success" />
                                                <span>Configured</span>
                                            </>
                                        ) : (
                                            <>
                                                <X className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-muted-foreground">Not configured</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ollama Status */}
                        <div className="p-4 rounded-lg border border-border bg-surface">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="font-medium mb-1">Ollama (Local)</div>
                                    <p className="text-sm text-muted-foreground">
                                        {ollamaStatus?.base_url || 'http://localhost:11434'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {ollamaStatus?.available ? (
                                        <span className="flex items-center gap-1 text-sm text-success">
                                            <Check className="w-4 h-4" />
                                            Running
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                                            <X className="w-4 h-4" />
                                            Not running
                                        </span>
                                    )}
                                    <Button variant="ghost" size="icon" onClick={fetchStatus}>
                                        <RefreshCw className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {ollamaStatus?.available && (
                                <>
                                    <div className="mb-4">
                                        <Label className="text-sm text-muted-foreground mb-2 block">
                                            Current Model
                                        </Label>
                                        <Select defaultValue={ollamaStatus.current_model}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="nomic-embed-text">nomic-embed-text</SelectItem>
                                                <SelectItem value="all-minilm">all-minilm</SelectItem>
                                                <SelectItem value="mxbai-embed-large">mxbai-embed-large</SelectItem>
                                                <SelectItem value="bge-m3">bge-m3</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => pullModel('nomic-embed-text')}
                                            disabled={pullingModel}
                                        >
                                            {pullingModel ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Download className="w-4 h-4" />
                                            )}
                                            Pull Model
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={testOllama}
                                            disabled={testingOllama}
                                        >
                                            {testingOllama ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                'Test Embedding'
                                            )}
                                        </Button>
                                    </div>

                                    {testResult && (
                                        <div className={`mt-3 p-2 rounded text-sm ${testResult.success
                                            ? 'bg-success/10 text-success'
                                            : 'bg-destructive/10 text-destructive'
                                            }`}>
                                            {testResult.message}
                                        </div>
                                    )}
                                </>
                            )}

                            {!ollamaStatus?.available && (
                                <div className="text-sm text-muted-foreground">
                                    <p className="mb-2">Ollama is not running. To enable local embeddings:</p>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener" className="text-primary hover:underline">ollama.ai</a></li>
                                        <li>Run <code className="px-1 py-0.5 rounded bg-surface-hover">ollama serve</code></li>
                                        <li>Pull a model: <code className="px-1 py-0.5 rounded bg-surface-hover">ollama pull nomic-embed-text</code></li>
                                    </ol>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* Vector Store Section */}
                <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-8"
                >
                    <h2 className="text-lg font-medium mb-4">Vector Store</h2>

                    <div className="p-4 rounded-lg border border-border bg-surface">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-muted-foreground mb-1">Backend</div>
                                <div className="font-medium capitalize">
                                    {status?.vector_store.backend || 'Unknown'}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground mb-1">Status</div>
                                <div className="flex items-center gap-2">
                                    {status?.vector_store.available ? (
                                        <>
                                            <Check className="w-4 h-4 text-success" />
                                            <span>Available</span>
                                        </>
                                    ) : (
                                        <>
                                            <X className="w-4 h-4 text-warning" />
                                            <span className="text-muted-foreground">Not initialized</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            {status?.vector_store.count !== undefined && (
                                <div>
                                    <div className="text-muted-foreground mb-1">Stored Vectors</div>
                                    <div className="font-medium">{status.vector_store.count}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.section>

                {/* Back to Dashboard */}
                <div className="pt-4 border-t border-border">
                    <Link to="/dashboard" className="text-sm text-primary hover:underline">
                        ← Back to Dashboard
                    </Link>
                </div>
            </main>
        </div>
    );
}

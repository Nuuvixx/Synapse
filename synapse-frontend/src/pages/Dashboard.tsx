import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
    Plus,
    Layers,
    Clock,
    Users,
    Settings,
    LogOut,
    Loader2,
    MoreHorizontal,
    Trash2
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Workspace {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [activeTab, setActiveTab] = useState<'workspaces' | 'recent' | 'shared'>('workspaces');

    const getAuthHeaders = () => {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    };

    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch user info
                const userRes = await fetch(`${API_BASE}/api/auth/me`, {
                    headers: getAuthHeaders(),
                });
                if (!userRes.ok) throw new Error('Unauthorized');
                const userData = await userRes.json();
                setUser(userData);

                // Fetch workspaces with filter
                const filter = activeTab === 'workspaces' ? 'all' : activeTab;
                const wsRes = await fetch(`${API_BASE}/api/workspaces?filter=${filter}`, {
                    headers: getAuthHeaders(),
                });
                if (wsRes.ok) {
                    const wsData = await wsRes.json();
                    setWorkspaces(wsData);
                }
            } catch (err) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [navigate, activeTab]);

    const handleCreateWorkspace = async () => {
        setCreating(true);
        try {
            const response = await fetch(`${API_BASE}/api/workspaces`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    name: `Workspace ${workspaces.length + 1}`,
                    description: 'A new knowledge workspace',
                }),
            });
            if (response.ok) {
                const newWs = await response.json();
                navigate(`/workspace/${newWs.id}`);
            }
        } catch (err) {
            console.error('Failed to create workspace');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteWorkspace = async (id: string) => {
        try {
            await fetch(`${API_BASE}/api/workspaces/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            setWorkspaces(workspaces.filter((ws) => ws.id !== id));
        } catch (err) {
            console.error('Failed to delete workspace');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex">
            {/* Sidebar */}
            <aside className="w-60 border-r border-border bg-surface flex flex-col">
                <div className="p-4 border-b border-border">
                    <div className="text-lg font-semibold">Synapse</div>
                </div>

                <nav className="flex-1 p-2">
                    <div className="space-y-1">
                        <button
                            onClick={() => setActiveTab('workspaces')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full text-left ${activeTab === 'workspaces'
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-surface-hover'
                                }`}
                        >
                            <Layers className="w-4 h-4" />
                            Workspaces
                        </button>
                        <button
                            onClick={() => setActiveTab('recent')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full text-left ${activeTab === 'recent'
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-surface-hover'
                                }`}
                        >
                            <Clock className="w-4 h-4" />
                            Recent
                        </button>
                        <button
                            onClick={() => setActiveTab('shared')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm w-full text-left ${activeTab === 'shared'
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-surface-hover'
                                }`}
                        >
                            <Users className="w-4 h-4" />
                            Shared
                        </button>
                    </div>
                </nav>

                <div className="p-2 border-t border-border">
                    <Link
                        to="/settings"
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-surface-hover w-full text-left"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-surface-hover w-full text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign out
                    </button>
                </div>

                <div className="p-4 border-t border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{user?.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 p-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-semibold">
                                {activeTab === 'workspaces' && 'Workspaces'}
                                {activeTab === 'recent' && 'Recent Workspaces'}
                                {activeTab === 'shared' && 'Shared with Me'}
                            </h1>
                            <p className="text-muted-foreground">
                                {activeTab === 'workspaces' && 'Manage your knowledge workspaces'}
                                {activeTab === 'recent' && 'Recently accessed workspaces'}
                                {activeTab === 'shared' && 'Workspaces shared by others'}
                            </p>
                        </div>
                        <Button onClick={handleCreateWorkspace} disabled={creating}>
                            {creating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                            New workspace
                        </Button>
                    </div>

                    {workspaces.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-16"
                        >
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
                                <Layers className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h2 className="text-lg font-medium mb-2">No workspaces yet</h2>
                            <p className="text-muted-foreground mb-6">
                                Create your first workspace to start organizing knowledge
                            </p>
                            <Button onClick={handleCreateWorkspace} disabled={creating}>
                                <Plus className="w-4 h-4" />
                                Create workspace
                            </Button>
                        </motion.div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {workspaces.map((ws, i) => (
                                <motion.div
                                    key={ws.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Link
                                        to={`/workspace/${ws.id}`}
                                        className="block p-4 rounded-lg border border-border bg-surface hover:border-primary/50 transition-colors group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                                                <Layers className="w-5 h-5 text-primary" />
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button
                                                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-hover"
                                                        onClick={(e) => e.preventDefault()}
                                                    >
                                                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            handleDeleteWorkspace(ws.id);
                                                        }}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <h3 className="font-medium mb-1">{ws.name}</h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {ws.description || 'No description'}
                                        </p>
                                        <div className="mt-3 text-xs text-muted-foreground">
                                            Updated {new Date(ws.updated_at).toLocaleDateString()}
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

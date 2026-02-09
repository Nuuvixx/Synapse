import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import {
    Plus,
    FileText,
    Link as LinkIcon,
    Code2,
    Upload,
    Search,
    ZoomIn,
    ZoomOut,
    Maximize2,
    ArrowLeft,
    Loader2,
    Circle,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Item {
    id: string;
    item_type: 'note' | 'link' | 'code' | 'image' | 'pdf';
    title?: string;
    content: string;
    position_x: number;
    position_y: number;
    cluster_id?: string;
}

interface Cluster {
    id: string;
    name: string;
    color: string;
    center_x: number;
    center_y: number;
    radius: number;
    item_ids: string[];
}

interface Workspace {
    id: string;
    name: string;
    description?: string;
}

export default function WorkspaceCanvas() {
    const { workspaceId } = useParams<{ workspaceId: string }>();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addType, setAddType] = useState<'note' | 'link' | 'code'>('note');
    const [newContent, setNewContent] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [computingClusters, setComputingClusters] = useState(false);
    const [uploading, setUploading] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('access_token');
        return {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };
    }, []);

    // Fetch workspace data
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            navigate('/login');
            return;
        }

        const fetchData = async () => {
            try {
                // Fetch workspace
                const wsRes = await fetch(`${API_BASE}/api/workspaces/${workspaceId}`, {
                    headers: getAuthHeaders(),
                });
                if (!wsRes.ok) throw new Error('Workspace not found');
                const wsData = await wsRes.json();
                setWorkspace(wsData);

                // Fetch items
                const itemsRes = await fetch(`${API_BASE}/api/items?workspace_id=${workspaceId}`, {
                    headers: getAuthHeaders(),
                });
                if (itemsRes.ok) {
                    const itemsData = await itemsRes.json();
                    setItems(itemsData);
                }

                // Fetch clusters
                const clustersRes = await fetch(`${API_BASE}/api/clusters/workspace/${workspaceId}`, {
                    headers: getAuthHeaders(),
                });
                if (clustersRes.ok) {
                    const clustersData = await clustersRes.json();
                    setClusters(clustersData);
                }
            } catch (err) {
                navigate('/dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [workspaceId, navigate, getAuthHeaders]);

    // Socket.IO connection for physics updates
    useEffect(() => {
        if (!workspaceId) return;

        // Connect to Socket.IO
        const socket = io(API_BASE, {
            transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('✅ Connected to Socket.IO');
            // Join workspace room
            socket.emit('join_workspace', {
                workspace_id: workspaceId,
                user_name: 'User'
            });
        });

        // Listen for physics updates
        socket.on('physics_update', (data: { updates: Record<string, { x: number; y: number }> }) => {
            setItems(prevItems => {
                const updatedItems = [...prevItems];
                // Convert updates object to array of [id, update] pairs
                Object.entries(data.updates).forEach(([id, update]) => {
                    const itemIndex = updatedItems.findIndex(item => item.id === id);
                    if (itemIndex !== -1) {
                        updatedItems[itemIndex] = {
                            ...updatedItems[itemIndex],
                            position_x: update.x,
                            position_y: update.y
                        };
                    }
                });
                return updatedItems;
            });
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from Socket.IO');
        });

        // Cleanup
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [workspaceId]);

    // Handle zoom
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom((z) => Math.min(Math.max(z * delta, 0.1), 3));
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            return () => canvas.removeEventListener('wheel', handleWheel);
        }
    }, [handleWheel]);

    // Keyboard listeners for spacebar
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                setIsSpacePressed(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                e.preventDefault();
                setIsSpacePressed(false);
                setIsPanning(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Handle panning
    const handleMouseDown = (e: React.MouseEvent) => {
        // Right-click, middle-click, spacebar+left-click, or alt+left-click to pan
        if (e.button === 2 || e.button === 1 || (e.button === 0 && (isSpacePressed || e.altKey))) {
            e.preventDefault();
            setIsPanning(true);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan((p) => ({
                x: p.x + e.movementX,
                y: p.y + e.movementY,
            }));
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
    };

    // Add item
    const handleAddItem = async () => {
        if (!newContent.trim()) return;

        try {
            const response = await fetch(`${API_BASE}/api/items`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    item_type: addType,
                    title: newTitle || undefined,
                    content: newContent,
                    position_x: -pan.x / zoom + 400 + Math.random() * 200,
                    position_y: -pan.y / zoom + 300 + Math.random() * 200,
                }),
            });

            if (response.ok) {
                const newItem = await response.json();
                setItems((prev) => [...prev, newItem]);
                setShowAddModal(false);
                setNewContent('');
                setNewTitle('');
            }
        } catch (err) {
            console.error('Failed to add item');
        }
    };

    // Compute clusters
    const handleComputeClusters = async () => {
        setComputingClusters(true);
        try {
            const response = await fetch(`${API_BASE}/api/clusters/workspace/${workspaceId}/compute`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    algorithm: 'dbscan',
                    eps: 0.5,
                    min_samples: 2,
                    use_llm_naming: false,
                }),
            });

            if (response.ok) {
                const newClusters = await response.json();
                setClusters(newClusters);
            }
        } catch (err) {
            console.error('Failed to compute clusters');
        } finally {
            setComputingClusters(false);
        }
    };

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('workspace_id', workspaceId!);

            const response = await fetch(`${API_BASE}/api/files/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('access_token')}`,
                },
                body: formData,
            });

            if (response.ok) {
                const uploadData = await response.json();

                // Add the new item to the canvas immediately
                if (uploadData.item) {
                    const newItem: Item = {
                        id: uploadData.item.id,
                        item_type: uploadData.item.item_type,
                        title: uploadData.item.title,
                        content: `Uploaded: ${uploadData.filename}`,
                        position_x: uploadData.item.position_x,
                        position_y: uploadData.item.position_y,
                    };
                    setItems((prev) => [...prev, newItem]);
                }
            } else {
                console.error('File upload failed');
            }
        } catch (err) {
            console.error('Failed to upload file:', err);
        } finally {
            setUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Get icon for item type
    const getItemIcon = (type: string) => {
        switch (type) {
            case 'note': return FileText;
            case 'link': return LinkIcon;
            case 'code': return Code2;
            default: return FileText;
        }
    };

    // Zoom controls
    const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
    const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.1));
    const handleResetZoom = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background overflow-hidden relative">
            {/* Header */}
            <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur border-b border-border">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="font-medium">{workspace?.name}</h1>
                        <p className="text-xs text-muted-foreground">{items.length} items</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-border">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
                            <ZoomOut className="w-3.5 h-3.5" />
                        </Button>
                        <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
                            <ZoomIn className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleResetZoom} title="Reset view">
                            <Maximize2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    <Button variant="ghost" size="icon">
                        <Search className="w-4 h-4" />
                    </Button>
                </div>
            </header>

            {/* Canvas */}
            <div
                ref={canvasRef}
                className={`absolute inset-0 ${isPanning ? 'cursor-grabbing' : isSpacePressed ? 'cursor-grab' : 'cursor-default'
                    }`}
                style={{ paddingTop: '60px' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onContextMenu={(e) => e.preventDefault()}
            >
                {/* Grid Background */}
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `
              linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)
            `,
                        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                        backgroundPosition: `${pan.x}px ${pan.y}px`,
                    }}
                />

                {/* Clusters Layer */}
                <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
                    <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                        {clusters.map((cluster) => (
                            <g key={cluster.id}>
                                <circle
                                    cx={cluster.center_x}
                                    cy={cluster.center_y + 60}
                                    r={cluster.radius}
                                    fill={cluster.color}
                                    fillOpacity={0.1}
                                    stroke={cluster.color}
                                    strokeOpacity={0.3}
                                    strokeWidth={2 / zoom}
                                />
                                {zoom < 0.6 && (
                                    <text
                                        x={cluster.center_x}
                                        y={cluster.center_y + 60}
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="white"
                                        fontSize={14 / zoom}
                                        fontWeight="500"
                                    >
                                        {cluster.name}
                                    </text>
                                )}
                            </g>
                        ))}
                    </g>
                </svg>

                {/* Items Layer */}
                <div
                    className="absolute inset-0"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: '0 0',
                    }}
                >
                    <AnimatePresence>
                        {items.map((item) => {
                            const Icon = getItemIcon(item.item_type);
                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="absolute p-3 rounded-md border border-border bg-surface hover:border-primary/50 cursor-pointer transition-colors"
                                    style={{
                                        left: item.position_x,
                                        top: item.position_y + 60,
                                        maxWidth: 200,
                                    }}
                                    onClick={() => setSelectedItem(item)}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Icon className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm font-medium truncate">
                                            {item.title || item.item_type}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {item.content}
                                    </p>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Bottom Toolbar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1.5 rounded-full bg-surface/90 backdrop-blur border border-border shadow-lg">
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => { setAddType('note'); setShowAddModal(true); }}
                >
                    <FileText className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => { setAddType('link'); setShowAddModal(true); }}
                >
                    <LinkIcon className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => { setAddType('code'); setShowAddModal(true); }}
                >
                    <Code2 className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept=".pdf,.png,.jpg,.jpeg,.gif,.txt,.md,.json"
                />
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-1 p-1 rounded-lg bg-surface/90 backdrop-blur border border-border">
                <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.min(z * 1.2, 3))}>
                    <ZoomIn className="w-4 h-4" />
                </Button>
                <div className="text-xs text-center text-muted-foreground py-1">
                    {Math.round(zoom * 100)}%
                </div>
                <Button variant="ghost" size="icon" onClick={() => setZoom((z) => Math.max(z * 0.8, 0.1))}>
                    <ZoomOut className="w-4 h-4" />
                </Button>
                <div className="h-px bg-border" />
                <Button variant="ghost" size="icon" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
                    <Maximize2 className="w-4 h-4" />
                </Button>
            </div>

            {/* Cluster Controls */}
            <div className="absolute bottom-6 left-6 z-20">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleComputeClusters}
                    disabled={computingClusters || items.length < 2}
                >
                    {computingClusters ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Circle className="w-4 h-4" />
                    )}
                    Clusters ({clusters.length})
                </Button>
            </div>

            {/* Add Item Modal */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {addType === 'note' && <FileText className="w-5 h-5" />}
                            {addType === 'link' && <LinkIcon className="w-5 h-5" />}
                            {addType === 'code' && <Code2 className="w-5 h-5" />}
                            Add {addType}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Input
                                placeholder="Title (optional)"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                            />
                        </div>
                        <div>
                            <textarea
                                className="w-full h-32 p-3 rounded-md border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder={
                                    addType === 'note' ? 'Write your note...' :
                                        addType === 'link' ? 'Paste URL...' :
                                            'Paste code...'
                                }
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddItem} disabled={!newContent.trim()}>
                                Add {addType}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Item Detail Panel */}
            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ x: 320, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: 320, opacity: 0 }}
                        className="absolute top-0 right-0 bottom-0 w-80 bg-surface border-l border-border z-30 flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="font-medium">Item Details</h2>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex-1 p-4 overflow-auto">
                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs text-muted-foreground mb-1">Type</div>
                                    <div className="text-sm capitalize">{selectedItem.item_type}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground mb-1">Title</div>
                                    <div className="text-sm">{selectedItem.title || 'Untitled'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground mb-1">Content</div>
                                    <div className="text-sm whitespace-pre-wrap">{selectedItem.content}</div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

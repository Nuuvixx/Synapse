
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

export function TitleBar() {
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        setIsMac(window.navigator.userAgent.includes("Mac"));
    }, []);

    const handleMinimize = () => window.electron.ipcRenderer.send("window-minimize");
    const handleMaximize = () => window.electron.ipcRenderer.send("window-maximize");
    const handleClose = () => window.electron.ipcRenderer.send("window-close");

    return (
        <div
            className="h-8 w-full flex items-center justify-between px-2 select-none z-50 relative app-drag-region"
            style={{
                background: 'var(--sg-chrome)',
                borderBottom: '1px solid var(--sg-border-subtle)',
            }}
        >
            {/* Draggable Area - Title / Icon */}
            <div className="flex items-center gap-2 pl-2">
                <div
                    className="w-3 h-3 rounded-full"
                    style={{
                        background: 'linear-gradient(135deg, var(--sg-cyan), var(--sg-purple))',
                        boxShadow: '0 0 8px rgba(34, 211, 238, 0.4)',
                    }}
                />
                <span
                    className="text-xs font-semibold tracking-wide"
                    style={{ color: 'var(--sg-text-secondary)' }}
                >
                    Ariadne
                </span>
            </div>

            {/* Window Controls (Windows Style) */}
            {!isMac && (
                <div className="flex items-center h-full no-drag-region">
                    <button
                        onClick={handleMinimize}
                        className="h-8 w-10 flex items-center justify-center transition-colors"
                        style={{ color: 'var(--sg-text-tertiary)' }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--sg-surface-3)';
                            e.currentTarget.style.color = 'var(--sg-text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--sg-text-tertiary)';
                        }}
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="h-8 w-10 flex items-center justify-center transition-colors"
                        style={{ color: 'var(--sg-text-tertiary)' }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--sg-surface-3)';
                            e.currentTarget.style.color = 'var(--sg-text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--sg-text-tertiary)';
                        }}
                    >
                        <Square size={12} />
                    </button>
                    <button
                        onClick={handleClose}
                        className="h-8 w-10 flex items-center justify-center transition-colors"
                        style={{ color: 'var(--sg-text-tertiary)' }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--sg-text-tertiary)';
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

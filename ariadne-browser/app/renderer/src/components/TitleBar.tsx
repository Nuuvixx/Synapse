
import { Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

export function TitleBar() {
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        // Check platform if exposed, otherwise default to Windows style
        // You might want to expose process.platform via preload if needed
        setIsMac(window.navigator.userAgent.includes("Mac"));
    }, []);

    const handleMinimize = () => window.electron.ipcRenderer.send("window-minimize");
    const handleMaximize = () => window.electron.ipcRenderer.send("window-maximize");
    const handleClose = () => window.electron.ipcRenderer.send("window-close");

    return (
        <div className="h-8 w-full bg-background/80 backdrop-blur-md flex items-center justify-between px-2 select-none border-b border-border z-50 relative app-drag-region">
            {/* Draggable Area - Title / Icon */}
            <div className="flex items-center gap-2 pl-2">
                <div className="w-3 h-3 rounded-full bg-gradient-to-tr from-primary to-accent opacity-80" />
                <span className="text-xs font-medium text-foreground/70">Ariadne</span>
            </div>

            {/* Window Controls (Windows Style) */}
            {!isMac && (
                <div className="flex items-center h-full no-drag-region">
                    <button
                        onClick={handleMinimize}
                        className="h-8 w-10 flex items-center justify-center hover:bg-muted transition-colors text-foreground/60 hover:text-foreground"
                    >
                        <Minus size={14} />
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="h-8 w-10 flex items-center justify-center hover:bg-muted transition-colors text-foreground/60 hover:text-foreground"
                    >
                        <Square size={12} />
                    </button>
                    <button
                        onClick={handleClose}
                        className="h-8 w-10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-foreground/60"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}

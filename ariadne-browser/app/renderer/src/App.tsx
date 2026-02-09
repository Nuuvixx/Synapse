
import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Menu, PanelRight, Maximize2, Minimize2 } from 'lucide-react';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { Sidebar } from '@/components/graph/Sidebar';
import { TitleBar } from '@/components/TitleBar';
import { BrowserPanel } from '@/components/browser';
import { isExtensionMode } from '@/store/demoData';
import { cn } from '@/lib/utils';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(true); // Open by default
  const [fullscreenBrowser, setFullscreenBrowser] = useState(false); // Fullscreen browser mode
  const [isExtension, setIsExtension] = useState(false);

  useEffect(() => {
    setIsExtension(isExtensionMode());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle sidebar with Alt+G
      if (e.altKey && e.key === 'g') {
        setSidebarOpen(prev => !prev);
      }
      // Toggle browser with Alt+B
      if (e.altKey && e.key === 'b') {
        setBrowserOpen(prev => !prev);
      }
      // Toggle fullscreen browser with Alt+F
      if (e.altKey && e.key === 'f') {
        setFullscreenBrowser(prev => !prev);
      }
      // Close overlays with Escape
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setFullscreenBrowser(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fullscreen browser mode hides the graph
  const showGraph = !fullscreenBrowser;

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col">
      {/* 1. Custom Title Bar */}
      <TitleBar />

      {/* 2. Main Workspace */}
      <div className="flex-1 relative flex overflow-hidden">
        <ReactFlowProvider>
          {/* Sidebar (Overlay) - only show when graph is visible */}
          {showGraph && (
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          )}

          {/* Graph Canvas & Toolbar - conditionally hidden */}
          {showGraph && (
            <div className="flex-1 relative flex flex-col">
              {/* Hamburger Menu (Visible when sidebar closed) */}
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: sidebarOpen ? 0 : 1, scale: 1 }}
                className={cn(
                  "absolute top-4 left-4 z-30 p-2 rounded-lg transition-all",
                  "bg-slate-800/50 backdrop-blur-sm border border-slate-700/50",
                  "hover:bg-slate-700 hover:border-slate-600",
                  "text-slate-400 hover:text-slate-200"
                )}
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </motion.button>

              {/* Graph Canvas */}
              <main className="flex-1 relative bg-slate-950">
                <GraphCanvas />
              </main>
            </div>
          )}

          {/* Browser Panel - takes full width when fullscreen */}
          <BrowserPanel
            isOpen={browserOpen}
            fullscreen={fullscreenBrowser}
            onToggleFullscreen={() => setFullscreenBrowser(!fullscreenBrowser)}
          />

          {/* Control Buttons - Fixed Position */}
          <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            {/* Fullscreen Browser Toggle */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-2 rounded-lg transition-all",
                "bg-slate-800/50 backdrop-blur-sm border border-slate-700/50",
                "hover:bg-slate-700 hover:border-slate-600",
                fullscreenBrowser
                  ? "text-emerald-400 border-emerald-500/50"
                  : "text-slate-400 hover:text-slate-200"
              )}
              onClick={() => setFullscreenBrowser(!fullscreenBrowser)}
              title={fullscreenBrowser ? "Show Graph (Alt+F)" : "Fullscreen Browser (Alt+F)"}
            >
              {fullscreenBrowser ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </motion.button>

            {/* Browser Toggle Button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: fullscreenBrowser ? 0 : 1, scale: 1 }}
              className={cn(
                "p-2 rounded-lg transition-all",
                "bg-slate-800/50 backdrop-blur-sm border border-slate-700/50",
                "hover:bg-slate-700 hover:border-slate-600",
                browserOpen ? "text-cyan-400 border-cyan-500/50" : "text-slate-400 hover:text-slate-200",
                fullscreenBrowser && "pointer-events-none"
              )}
              onClick={() => setBrowserOpen(!browserOpen)}
              title="Toggle Browser (Alt+B)"
            >
              <PanelRight className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Demo Mode Warning */}
          {!isExtension && !fullscreenBrowser && (
            <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-500 backdrop-blur-md">
                <p>Demo Mode</p>
              </div>
            </div>
          )}
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export default App;


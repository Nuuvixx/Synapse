
import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { Sidebar } from '@/components/graph/Sidebar';
import { TitleBar } from '@/components/TitleBar';
import { isExtensionMode } from '@/store/demoData';
import { cn } from '@/lib/utils';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isExtension, setIsExtension] = useState(false);

  useEffect(() => {
    setIsExtension(isExtensionMode());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'g') {
        setSidebarOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col">
      {/* 1. Custom Title Bar */}
      <TitleBar />

      {/* 2. Main Workspace */}
      <div className="flex-1 relative flex overflow-hidden">
        <ReactFlowProvider>
          {/* Sidebar (Overlay) */}
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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

          {/* Demo Mode Warning */}
          {!isExtension && (
            <div className="absolute bottom-4 right-4 z-50 pointer-events-none">
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

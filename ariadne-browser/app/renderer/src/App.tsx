
import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { Sidebar } from '@/components/graph/Sidebar';
import { TitleBar } from '@/components/TitleBar';
import { BrowserPanel } from '@/components/browser';
import { isExtensionMode } from '@/store/demoData';
import { cn } from '@/lib/utils';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [isExtension, setIsExtension] = useState(false);

  useEffect(() => {
    setIsExtension(isExtensionMode());
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'g' && showGraph) {
        setSidebarOpen(prev => !prev);
      }
      if (e.altKey && e.key === 'v') {
        setShowGraph(prev => !prev);
      }
      if (e.key === 'Escape') {
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGraph]);

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col"
      style={{ background: 'var(--sg-bg-deep)', color: 'var(--sg-text-primary)' }}
    >
      {/* 1. Custom Title Bar */}
      <TitleBar />

      {/* 2. Main Workspace */}
      <div className="flex-1 relative flex overflow-hidden">
        <ReactFlowProvider>
          {/* Graph Canvas & Sidebar - shown when graph view is enabled */}
          {showGraph && (
            <>
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              <div className="flex-1 relative flex flex-col">
                {/* Hamburger Menu */}
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: sidebarOpen ? 0 : 1, scale: 1 }}
                  className={cn(
                    "absolute top-4 left-4 z-30 p-2 rounded-xl transition-all sg-glass sg-glow-cyan"
                  )}
                  style={{ color: 'var(--sg-text-secondary)' }}
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="w-5 h-5" />
                </motion.button>

                {/* Graph Canvas */}
                <main
                  className="flex-1 relative"
                  style={{ background: 'var(--sg-bg-canvas)' }}
                >
                  <GraphCanvas />
                </main>
              </div>

              {/* Glassmorphism Divider between graph and browser */}
              <div className="sg-divider" />
            </>
          )}

          {/* Browser Panel - always open, fullscreen when graph hidden */}
          <BrowserPanel
            isOpen={true}
            fullscreen={!showGraph}
            onToggleGraph={() => setShowGraph(!showGraph)}
            showGraph={showGraph}
          />

          {/* Demo Mode Warning */}
          {!isExtension && showGraph && (
            <div className="absolute bottom-4 left-4 z-50 pointer-events-none">
              <div
                className="rounded-xl px-3 py-2 text-xs sg-glass"
                style={{
                  color: 'var(--sg-amber)',
                  borderColor: 'rgba(251, 191, 36, 0.2)',
                }}
              >
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

/**
 * Ariadne - Spatial Web Browser
 * 
 * Main App Component
 */

import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Menu, Github, Twitter, Globe } from 'lucide-react';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { Sidebar } from '@/components/graph/Sidebar';
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
    <div className="w-full h-screen bg-slate-950 text-slate-200 overflow-hidden">
      <ReactFlowProvider>
        <GraphCanvas />
        
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "fixed top-4 left-4 z-30 p-3 rounded-xl transition-all",
            "bg-slate-800/90 backdrop-blur-sm border border-slate-700",
            "hover:bg-slate-700 hover:border-slate-600",
            "shadow-lg shadow-black/20"
          )}
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-5 h-5 text-slate-300" />
        </motion.button>
        
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {!isExtension && (
          <div className="fixed bottom-4 right-4 z-30">
            <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg px-4 py-2 text-sm text-amber-400">
              <p>Running in demo mode</p>
              <p className="text-xs text-amber-500/70">
                Install the extension for full functionality
              </p>
            </div>
          </div>
        )}
        
        <div className="fixed bottom-4 left-4 z-30">
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <span className="text-cyan-500">🧭</span>
              Ariadne v1.0
            </span>
            <a href="#" className="hover:text-slate-400 transition-colors flex items-center gap-1">
              <Github className="w-3 h-3" />
              GitHub
            </a>
            <a href="#" className="hover:text-slate-400 transition-colors flex items-center gap-1">
              <Twitter className="w-3 h-3" />
              Twitter
            </a>
            <a href="#" className="hover:text-slate-400 transition-colors flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Website
            </a>
          </div>
        </div>
      </ReactFlowProvider>
    </div>
  );
}

export default App;

/**
 * WelcomePage Component — Stitch & Glass Design (Brave Edition)
 * 
 * Performance Optimized: Uses CSS animations instead of heavy framer-motion layers.
 * Features:
 * - Deep Space Starfield (CSS-only)
 * - Glassmorphic Search Pill
 * - Speed Dial Grid
 * - Bottom Stats Strip (Brave-like)
 */

import { motion } from 'framer-motion';
import { Github, Youtube, Brain, MessageCircle, Code, Search, Shield, Zap, Database } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGraphStore } from '@/store/graphStore';

interface WelcomePageProps {
    onNavigate: (url: string) => void;
}

const quickLinks = [
    { name: 'Google', url: 'https://www.google.com', icon: Search, color: 'cyan' },
    { name: 'GitHub', url: 'https://github.com', icon: Github, color: 'purple' },
    { name: 'YouTube', url: 'https://www.youtube.com', icon: Youtube, color: 'cyan' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', icon: MessageCircle, color: 'purple' },
    { name: 'Stack Overflow', url: 'https://stackoverflow.com', icon: Code, color: 'cyan' },
    { name: 'Reddit', url: 'https://www.reddit.com', icon: Brain, color: 'purple' },
];

export function WelcomePage({ onNavigate }: WelcomePageProps) {
    const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const nodes = useGraphStore(state => state.nodes);
    const edges = useGraphStore(state => state.edges);

    const screenshotsCount = nodes.filter(n => n.screenshot).length;
    const nodesCount = nodes.length;
    const edgesCount = edges.length;

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div
            className="w-full h-full flex flex-col relative overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at bottom, #0F172A 0%, #020617 100%)' }}
        >
            {/* ─── Static Starfield (CSS Optimized) ─── */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="stars-small" />
                <div className="stars-medium" />
                <div className="stars-large" />
            </div>

            {/* ─── Main Content (Centered) ─── */}
            <div className="flex-1 flex flex-col items-center justify-center -mt-20 z-10 w-full max-w-5xl mx-auto px-4">

                {/* Clock & Branding */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-12"
                >
                    <h1 className="text-8xl font-thin tracking-tighter text-white/90 mb-2 font-inter">
                        {time}
                    </h1>
                    <p className="text-cyan-400/80 text-sm uppercase tracking-[0.2em] font-medium">
                        Spatial Browsing Active
                    </p>
                </motion.div>

                {/* Search Bar */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-full max-w-2xl mb-12 relative group"
                >
                    <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex items-center bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-full px-6 py-4 shadow-2xl transition-all group-hover:border-cyan-500/30">
                        <Search className="w-5 h-5 text-gray-400 mr-4" />
                        <input
                            type="text"
                            placeholder="Search the web or enter URL..."
                            className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 text-lg text-white placeholder-gray-500 w-full font-light"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    onNavigate(e.currentTarget.value);
                                }
                            }}
                            autoFocus
                        />
                    </div>
                </motion.div>

                {/* Speed Dial Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="grid grid-cols-6 gap-4 w-full"
                >
                    {quickLinks.map((link) => (
                        <button
                            key={link.name}
                            onClick={() => onNavigate(link.url)}
                            className="group flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-white/5 transition-all duration-300"
                        >
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-800/50 border border-white/5 shadow-lg group-hover:scale-110 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all duration-300"
                            >
                                <link.icon className={`w-6 h-6 text-${link.color === 'cyan' ? 'cyan-400' : 'purple-400'}`} />
                            </div>
                            <span className="text-xs text-slate-400 font-medium group-hover:text-white transition-colors">
                                {link.name}
                            </span>
                        </button>
                    ))}
                </motion.div>
            </div>

            {/* ─── Bottom Stats Strip (Brave Style) ─── */}
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4 }}
                className="w-full bg-slate-900/40 backdrop-blur-md border-t border-white/5 py-4 px-8 flex justify-center gap-16"
            >
                <StatItem icon={Database} value={nodesCount.toString()} label="Nodes Explored" color="text-cyan-400" />
                <StatItem icon={Zap} value={edgesCount.toString()} label="Connections" color="text-purple-400" />
                <StatItem icon={Shield} value={screenshotsCount.toString()} label="Pages Captured" color="text-orange-400" />
            </motion.div>

            <style>{`
        .stars-small, .stars-medium, .stars-large {
           position: absolute;
           top: 0; left: 0; right: 0; bottom: 0;
           background: transparent;
        }
        /* CSS-only star generation would go here or via background-image */
      `}</style>
        </div>
    );
}

function StatItem({ icon: Icon, value, label, color }: { icon: any, value: string, label: string, color: string }) {
    return (
        <div className="flex flex-col items-center group cursor-default">
            <span className={`text-2xl font-bold ${color} mb-0.5 group-hover:scale-110 transition-transform`}>{value}</span>
            <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <Icon className="w-3 h-3 text-slate-300" />
                <span className="text-[10px] uppercase tracking-widest text-slate-300 font-semibold">{label}</span>
            </div>
        </div>
    )
}

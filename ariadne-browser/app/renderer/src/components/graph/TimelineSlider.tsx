/**
 * Timeline Slider Component
 * 
 * Allows users to scrub through the browsing session history.
 * Shows nodes appearing in chronological order.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';
import { cn } from '@/lib/utils';

interface TimelineSliderProps {
  onClose: () => void;
}

export function TimelineSlider({ onClose }: TimelineSliderProps) {
  const timeline = useGraphStore(state => state.timeline);
  const isPlaying = useGraphStore(state => state.isPlayingTimeline);
  const progress = useGraphStore(state => state.timelineProgress);
  
  const loadTimeline = useGraphStore(state => state.loadTimeline);
  const setTimelineProgress = useGraphStore(state => state.setTimelineProgress);
  const playTimeline = useGraphStore(state => state.playTimeline);
  const pauseTimeline = useGraphStore(state => state.pauseTimeline);
  
  const sliderRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Load timeline on mount
  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);
  
  // Format time
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };
  
  // Handle slider click/drag
  const handleSliderInteraction = useCallback((clientX: number) => {
    if (!sliderRef.current || !timeline) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    setTimelineProgress(percentage);
  }, [timeline, setTimelineProgress]);
  
  // Mouse events for slider
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSliderInteraction(e.clientX);
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleSliderInteraction(e.clientX);
    }
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleSliderInteraction(e.touches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      handleSliderInteraction(e.touches[0].clientX);
    }
  };
  
  const handleTouchEnd = () => {
    setIsDragging(false);
  };
  
  // Animation loop
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        const currentProgress = useGraphStore.getState().timelineProgress;
        const newProgress = currentProgress + 0.001;
        
        if (newProgress >= 1) {
          pauseTimeline();
          setTimelineProgress(1);
        } else {
          setTimelineProgress(newProgress);
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, setTimelineProgress, pauseTimeline]);
  
  // Get current visible nodes based on progress
  const getVisibleNodesCount = () => {
    if (!timeline) return 0;
    
    const currentTime = timeline.startTime + (timeline.endTime - timeline.startTime) * progress;
    return timeline.events.filter(e => e.timestamp <= currentTime).length;
  };
  
  // Get event markers for the timeline
  const getEventMarkers = () => {
    if (!timeline) return [];
    
    return timeline.events.map(event => {
      const position = (event.timestamp - timeline.startTime) / (timeline.endTime - timeline.startTime);
      return {
        position: Math.max(0, Math.min(1, position)),
        type: event.type,
        timestamp: event.timestamp
      };
    });
  };
  
  if (!timeline) {
    return (
      <div className="bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 p-4">
        <div className="flex items-center justify-center text-slate-400">
          <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mr-2" />
          Loading timeline...
        </div>
      </div>
    );
  }
  
  const duration = timeline.endTime - timeline.startTime;
  const currentTime = timeline.startTime + duration * progress;
  const visibleCount = getVisibleNodesCount();
  const eventMarkers = getEventMarkers();
  
  return (
    <div className="bg-slate-800/95 backdrop-blur-sm border-t border-slate-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-medium text-slate-200">Session Timeline</h3>
          <span className="text-xs text-slate-500">
            {visibleCount} events visible
          </span>
        </div>
        
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => setTimelineProgress(0)}
          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          title="Go to start"
        >
          <SkipBack className="w-4 h-4" />
        </button>
        
        <button
          onClick={isPlaying ? pauseTimeline : playTimeline}
          className={cn(
            "p-3 rounded-lg transition-colors",
            isPlaying
              ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
              : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
          )}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        
        <button
          onClick={() => setTimelineProgress(1)}
          className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          title="Go to end"
        >
          <SkipForward className="w-4 h-4" />
        </button>
        
        {/* Time display */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-cyan-400 font-mono">{formatTime(currentTime)}</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-500 font-mono">{formatTime(timeline.endTime)}</span>
        </div>
        
        {/* Duration */}
        <span className="text-xs text-slate-500 ml-auto">
          {formatDuration(duration)}
        </span>
      </div>
      
      {/* Slider */}
      <div
        ref={sliderRef}
        className="relative h-12 bg-slate-900/50 rounded-lg cursor-pointer overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 opacity-50" />
        
        {/* Event markers */}
        {eventMarkers.map((marker, index) => (
          <div
            key={index}
            className={cn(
              "absolute top-0 w-0.5 h-full transition-opacity",
              marker.type === 'node_created' && "bg-cyan-500/30",
              marker.type === 'node_closed' && "bg-slate-500/30",
              marker.type === 'edge_created' && "bg-purple-500/30",
              marker.position <= progress ? "opacity-100" : "opacity-30"
            )}
            style={{ left: `${marker.position * 100}%` }}
          />
        ))}
        
        {/* Progress fill */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500/20 to-cyan-400/10"
          style={{ width: `${progress * 100}%` }}
          layoutId="timelineProgress"
        />
        
        {/* Playhead */}
        <motion.div
          className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-lg shadow-cyan-400/50"
          style={{ left: `${progress * 100}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-cyan-400 rounded-full" />
        </motion.div>
        
        {/* Time labels */}
        <div className="absolute bottom-1 left-2 text-[10px] text-slate-500">
          {formatTime(timeline.startTime)}
        </div>
        <div className="absolute bottom-1 right-2 text-[10px] text-slate-500">
          {formatTime(timeline.endTime)}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          <span className="text-slate-400">Page Opened</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <span className="text-slate-400">Page Closed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span className="text-slate-400">Link Created</span>
        </div>
      </div>
    </div>
  );
}

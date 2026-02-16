/**
 * Timeline Slider Component — Stitch & Glass Design
 * 
 * Glassmorphism timeline with glowing playhead,
 * neon event markers, and refined transport controls.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';
import { useGraphStore } from '@/store/graphStore';

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

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const handleSliderInteraction = useCallback((clientX: number) => {
    if (!sliderRef.current || !timeline) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setTimelineProgress(percentage);
  }, [timeline, setTimelineProgress]);

  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); handleSliderInteraction(e.clientX); };
  const handleMouseMove = (e: React.MouseEvent) => { if (isDragging) handleSliderInteraction(e.clientX); };
  const handleMouseUp = () => { setIsDragging(false); };
  const handleTouchStart = (e: React.TouchEvent) => { setIsDragging(true); handleSliderInteraction(e.touches[0].clientX); };
  const handleTouchMove = (e: React.TouchEvent) => { if (isDragging) handleSliderInteraction(e.touches[0].clientX); };
  const handleTouchEnd = () => { setIsDragging(false); };

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
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, setTimelineProgress, pauseTimeline]);

  const getVisibleNodesCount = () => {
    if (!timeline) return 0;
    const currentTime = timeline.startTime + (timeline.endTime - timeline.startTime) * progress;
    return timeline.events.filter(e => e.timestamp <= currentTime).length;
  };

  const getEventMarkers = () => {
    if (!timeline) return [];
    return timeline.events.map(event => ({
      position: Math.max(0, Math.min(1, (event.timestamp - timeline.startTime) / (timeline.endTime - timeline.startTime))),
      type: event.type,
      timestamp: event.timestamp
    }));
  };

  if (!timeline) {
    return (
      <div className="sg-glass p-4">
        <div className="flex items-center justify-center" style={{ color: 'var(--sg-text-tertiary)' }}>
          <div className="w-5 h-5 border-2 rounded-full animate-spin mr-2" style={{ borderColor: 'var(--sg-cyan)', borderTopColor: 'transparent' }} />
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
    <div className="sg-glass p-4" style={{ borderTop: '1px solid var(--sg-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--sg-text-primary)' }}>Session Timeline</h3>
          <span className="text-xs" style={{ color: 'var(--sg-text-ghost)' }}>{visibleCount} events visible</span>
        </div>
        <button onClick={onClose} className="transition-colors" style={{ color: 'var(--sg-text-tertiary)' }}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mb-4">
        <button onClick={() => setTimelineProgress(0)} className="p-2 rounded-xl transition-all" style={{ color: 'var(--sg-text-tertiary)' }} title="Go to start">
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={isPlaying ? pauseTimeline : playTimeline}
          className="p-3 rounded-xl transition-all"
          style={{
            background: isPlaying ? 'rgba(251, 191, 36, 0.1)' : 'rgba(34, 211, 238, 0.1)',
            color: isPlaying ? 'var(--sg-amber)' : 'var(--sg-cyan)',
            boxShadow: isPlaying ? '0 0 12px rgba(251, 191, 36, 0.15)' : '0 0 12px rgba(34, 211, 238, 0.15)',
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <button onClick={() => setTimelineProgress(1)} className="p-2 rounded-xl transition-all" style={{ color: 'var(--sg-text-tertiary)' }} title="Go to end">
          <SkipForward className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-semibold" style={{ color: 'var(--sg-cyan)' }}>{formatTime(currentTime)}</span>
          <span style={{ color: 'var(--sg-text-ghost)' }}>/</span>
          <span className="font-mono" style={{ color: 'var(--sg-text-ghost)' }}>{formatTime(timeline.endTime)}</span>
        </div>

        <span className="text-xs ml-auto" style={{ color: 'var(--sg-text-ghost)' }}>{formatDuration(duration)}</span>
      </div>

      {/* Slider */}
      <div
        ref={sliderRef}
        className="relative h-12 rounded-xl cursor-pointer overflow-hidden"
        style={{ background: 'var(--sg-surface-2)', border: '1px solid var(--sg-border-subtle)' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Event markers */}
        {eventMarkers.map((marker, index) => (
          <div
            key={index}
            className="absolute top-0 w-0.5 h-full transition-opacity"
            style={{
              left: `${marker.position * 100}%`,
              background: marker.type === 'node_created' ? 'rgba(34, 211, 238, 0.3)'
                : marker.type === 'node_closed' ? 'rgba(100, 116, 139, 0.3)'
                  : 'rgba(168, 85, 247, 0.3)',
              opacity: marker.position <= progress ? 1 : 0.3,
            }}
          />
        ))}

        {/* Progress fill */}
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${progress * 100}%`,
            background: 'linear-gradient(90deg, rgba(34, 211, 238, 0.4) 0%, rgba(34, 211, 238, 0.1) 100%)',
            boxShadow: '0 0 15px rgba(34, 211, 238, 0.2)'
          }}
          layoutId="timelineProgress"
        />

        {/* Playhead */}
        <motion.div
          className="absolute top-0 bottom-0 w-0.5 z-20"
          style={{
            left: `${progress * 100}%`,
            background: 'var(--sg-cyan)',
            boxShadow: '0 0 10px var(--sg-cyan)'
          }}
        >
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white"
            style={{
              background: 'var(--sg-cyan)',
              boxShadow: '0 0 15px var(--sg-cyan), inset 0 0 6px white'
            }}
          />
        </motion.div>

        {/* Time labels */}
        <div className="absolute bottom-1 left-2 text-[10px]" style={{ color: 'var(--sg-text-ghost)' }}>
          {formatTime(timeline.startTime)}
        </div>
        <div className="absolute bottom-1 right-2 text-[10px]" style={{ color: 'var(--sg-text-ghost)' }}>
          {formatTime(timeline.endTime)}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--sg-cyan)' }} />
          <span style={{ color: 'var(--sg-text-tertiary)' }}>Page Opened</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--sg-text-ghost)' }} />
          <span style={{ color: 'var(--sg-text-tertiary)' }}>Page Closed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--sg-purple)' }} />
          <span style={{ color: 'var(--sg-text-tertiary)' }}>Link Created</span>
        </div>
      </div>
    </div>
  );
}

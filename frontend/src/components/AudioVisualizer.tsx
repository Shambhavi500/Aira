import React, { useEffect, useState } from 'react';

export type CallAudioStatus = 'idle' | 'connecting' | 'speaking' | 'completed';

interface AudioVisualizerProps {
  isPlaying?: boolean;
  status?: CallAudioStatus;
  barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying = false,
  status = 'idle',
  barCount = 32,
}) => {
  const effectiveStatus: CallAudioStatus =
    status !== 'idle' ? status : isPlaying ? 'speaking' : 'idle';

  const [heights, setHeights] = useState<number[]>([]);

  useEffect(() => {
    if (effectiveStatus === 'idle') {
      setHeights(Array.from({ length: barCount }, () => 8));
      return;
    }

    if (effectiveStatus === 'completed') {
      setHeights(Array.from({ length: barCount }, (_, i) => 10 + (i % 4) * 2));
      return;
    }

    if (effectiveStatus === 'connecting') {
      const interval = setInterval(() => {
        setHeights(
          Array.from({ length: barCount }, (_, i) => {
            const pulse = Math.sin(Date.now() / 300 + i * 0.2) * 8 + 14;
            return Math.max(6, Math.round(pulse));
          })
        );
      }, 100);
      return () => clearInterval(interval);
    }

    if (effectiveStatus === 'speaking') {
      const interval = setInterval(() => {
        setHeights(
          Array.from({ length: barCount }, (_, i) => {
            const base = Math.sin(Date.now() / 180 + i * 0.4) * 16 + 22;
            const noise = Math.random() * 12;
            return Math.max(6, Math.min(46, Math.round(base + noise)));
          })
        );
      }, 85);
      return () => clearInterval(interval);
    }
  }, [effectiveStatus, barCount]);

  const getBarColor = () => {
    switch (effectiveStatus) {
      case 'speaking':
        return 'linear-gradient(180deg, #0D94FB 0%, #04DB7C 100%)';
      case 'connecting':
        return '#0D94FB';
      case 'completed':
        return '#94A3B8';
      case 'idle':
      default:
        return 'var(--border-strong, #CBD5E1)';
    }
  };

  return (
    <div
      className="audio-visualizer-container"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        height: '52px',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        padding: '0 16px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {heights.map((h, idx) => (
        <div
          key={idx}
          className={`audio-bar ${effectiveStatus === 'speaking' ? 'speaking' : ''}`}
          style={{
            width: '4px',
            borderRadius: '2px',
            height: `${h}px`,
            background: getBarColor(),
            opacity: effectiveStatus === 'idle' ? 0.6 : 1,
            transition: 'height 80ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      ))}
    </div>
  );
};

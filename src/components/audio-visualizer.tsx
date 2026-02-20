"use client";

import { useEffect, useRef } from "react";
import "./audio-visualizer.css";

interface AudioVisualizerProps {
  isActive: boolean;
  isUser?: boolean;
  className?: string;
  size?: "small" | "medium" | "large";
}

export function AudioVisualizer({ 
  isActive, 
  isUser = false, 
  className = "", 
  size = "medium" 
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on size prop
    const sizeMap = {
      small: { width: 40, height: 20, barCount: 8 },
      medium: { width: 60, height: 30, barCount: 12 },
      large: { width: 80, height: 40, barCount: 16 }
    };
    
    const { width, height, barCount } = sizeMap[size];
    canvas.width = width;
    canvas.height = height;

    let animationId: number;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (isActive) {
        // Draw animated bars
        const barWidth = width / barCount;
        const barSpacing = 2;
        
        for (let i = 0; i < barCount; i++) {
          const barHeight = Math.random() * height * 0.8 + height * 0.1;
          const x = i * barWidth + barSpacing / 2;
          const y = height - barHeight;
          
          // Create gradient for bars
          const gradient = ctx.createLinearGradient(0, y, 0, height);
          if (isUser) {
            gradient.addColorStop(0, '#3b59ab');
            gradient.addColorStop(1, '#2563eb');
          } else {
            gradient.addColorStop(0, '#e1502e');
            gradient.addColorStop(1, '#dc2626');
          }
          
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y, barWidth - barSpacing, barHeight);
        }
      } else {
        // Draw idle state - small dots
        ctx.fillStyle = isUser ? '#3b59ab' : '#e1502e';
        const dotSize = 2;
        const dotSpacing = width / 4;
        
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(dotSpacing * (i + 1), height / 2, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, isUser, size]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`audio-visualizer ${className}`}
    />
  );
}

// Microphone orb component
export function MicrophoneOrb({ isActive, className = "" }: { isActive: boolean; className?: string }) {
  return (
    <div className={`microphone-orb ${className} ${isActive ? 'active' : 'idle'}`}>
      <div className="orb-core">
        <div className="orb-inner"></div>
        {isActive && <div className="orb-pulse"></div>}
      </div>
    </div>
  );
}

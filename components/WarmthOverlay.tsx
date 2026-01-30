import React from 'react';

interface WarmthOverlayProps {
  intensity: number; // 0 to 100
}

export const WarmthOverlay: React.FC<WarmthOverlayProps> = ({ intensity }) => {
  if (intensity === 0) return null;

  // Calculate opacity based on intensity (max 0.5 to avoid making it unreadable)
  const opacity = (intensity / 100) * 0.4;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[60] mix-blend-multiply"
      style={{
        backgroundColor: `rgba(255, 160, 0, ${opacity})`,
        transition: 'background-color 0.3s ease',
      }}
    />
  );
};

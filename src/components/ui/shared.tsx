import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  intensity?: 'light' | 'medium' | 'heavy';
}

export function GlassCard({ children, className = '', intensity = 'medium', ...props }: GlassCardProps) {
  const intensityClasses = {
    light: 'bg-white/30 backdrop-blur-md border-white/40',
    medium: 'bg-white/45 backdrop-blur-xl border-white/60',
    heavy: 'bg-white/70 backdrop-blur-2xl border-white/80'
  };

  const classes = className.split(' ');
  const layoutClasses = classes.filter(c => 
    c.startsWith('flex') || 
    c.startsWith('gap-') || 
    c.startsWith('justify-') || 
    c.startsWith('items-')
  ).join(' ');

  return (
    <div 
      className={`relative rounded-[2rem] border shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden ${intensityClasses[intensity]} ${className}`}
      {...props}
    >
      <div className="absolute inset-0 rounded-[inherit] border border-white/80 pointer-events-none opacity-40 mix-blend-overlay"></div>
      <div className={`relative z-10 w-full h-full ${layoutClasses}`}>
        {children}
      </div>
    </div>
  );
}

export function AvatarPile({ count = 3, className = '' }: { count?: number, className?: string }) {
  const avatars = [
    'https://i.pravatar.cc/150?img=32',
    'https://i.pravatar.cc/150?img=12',
    'https://i.pravatar.cc/150?img=68',
    'https://i.pravatar.cc/150?img=47',
  ].slice(0, count);

  return (
    <div className={`flex items-center -space-x-2 ${className}`}>
      {avatars.map((src, i) => (
        <img 
          key={i} 
          src={src} 
          alt="Avatar" 
          className="w-8 h-8 rounded-full border-2 border-white/80 shadow-sm object-cover"
        />
      ))}
    </div>
  );
}

export function IconButton({ icon, className = '', onClick }: { icon: React.ReactNode, className?: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center justify-center w-10 h-10 rounded-full bg-white/50 hover:bg-white/80 transition-colors border border-white/60 shadow-sm text-neutral-700 ${className}`}
    >
      {icon}
    </button>
  );
}

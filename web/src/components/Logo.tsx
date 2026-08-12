import { Link } from 'react-router-dom';

type LogoSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<LogoSize, { img: string; text: string; gap: string }> = {
  sm: { img: 'size-6', text: 'text-sm', gap: 'gap-2' },
  md: { img: 'size-7', text: 'text-[15px]', gap: 'gap-2.5' },
  lg: { img: 'size-9', text: 'text-lg', gap: 'gap-2.5' },
};

export function Logo({ size = 'md', className }: { size?: LogoSize; className?: string }) {
  const s = sizeClasses[size];
  return (
    <Link to="/" className={`flex items-center ${s.gap} ${className ?? ''}`}>
      <img src="/favicon.svg" alt="" className={`rounded-full ${s.img}`} />
      <span className={`font-semibold tracking-tight ${s.text}`}>SagotKa</span>
    </Link>
  );
}

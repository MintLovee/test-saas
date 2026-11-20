import type { ReactNode } from 'react';

export function LiquidBackground({ children }: { children: ReactNode }) {
  return (
    <div className="liquid-canvas min-h-screen w-full overflow-x-clip relative">
      {/* Ambient refractive blobs behind glass layers */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div
          className="liquid-blob-1 absolute -top-24 -left-24 h-[440px] w-[440px] rounded-full opacity-70 dark:opacity-45 blur-[80px]"
          style={{
            background:
              'radial-gradient(circle, rgba(96, 165, 250, 0.72) 0%, rgba(167, 139, 250, 0.35) 65%, transparent 100%)',
          }}
        />
        <div
          className="liquid-blob-2 absolute top-1/4 -right-28 h-[480px] w-[480px] rounded-full opacity-65 dark:opacity-40 blur-[90px]"
          style={{
            background:
              'radial-gradient(circle, rgba(244, 114, 182, 0.62) 0%, rgba(192, 132, 252, 0.32) 65%, transparent 100%)',
          }}
        />
        <div
          className="liquid-blob-3 absolute -bottom-28 left-1/4 h-[460px] w-[460px] rounded-full opacity-70 dark:opacity-40 blur-[85px]"
          style={{
            background:
              'radial-gradient(circle, rgba(94, 234, 212, 0.64) 0%, rgba(56, 189, 248, 0.3) 65%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}

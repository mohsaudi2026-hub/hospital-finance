import React from 'react'
import Image from 'next/image'

interface MOHLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | number
  className?: string
  showText?: boolean
  textColor?: string
}

export function MOHLogo({
  size = 'md',
  className = '',
  showText = false,
  textColor = 'text-gray-900',
}: MOHLogoProps) {
  const sizeMap = {
    sm: 36,
    md: 48,
    lg: 64,
    xl: 88,
  }

  const dimension = typeof size === 'number' ? size : sizeMap[size] || 48

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Official MOH Logo Image from /images/mohp-logo.png */}
      <div
        className="relative shrink-0 flex items-center justify-center select-none drop-shadow-xs"
        style={{ width: `${dimension}px`, height: `${dimension}px` }}
      >
        <Image
          src="/images/mohp-logo.png"
          alt="شعار وزارة الصحة والسكان المصرية"
          width={dimension}
          height={dimension}
          className="object-contain w-full h-full"
          priority
        />
      </div>

      {/* Optional Typography */}
      {showText && (
        <div className="leading-tight">
          <h2 className={`font-extrabold text-sm sm:text-base ${textColor}`}>
            جمهورية مصر العربية
          </h2>
          <p className="text-xs font-bold text-[var(--color-primary)]">
            وزارة الصحة والسكان
          </p>
          <p className="text-[10px] text-amber-700 font-semibold">
            المكتب الفني لمساعد الوزير
          </p>
        </div>
      )}
    </div>
  )
}

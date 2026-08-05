import React from 'react'

/**
 * NaturalStamp Component
 * Renders an ultra-realistic, authentic rubber stamp with organic tilt,
 * natural rough/grunge texture, ink bleed, and mix-blend-multiply.
 */
export default function NaturalStamp({
  stampImage = null,
  companyName = '',
  companyNameAr = '',
  crNumber = '',
  vatNumber = '',
  language = 'en',
  size = 'md', // 'sm' | 'md' | 'lg'
  color = 'blue', // 'blue' | 'red' | 'navy'
  className = ''
}) {
  const isAr = language === 'ar'

  // Dimensions based on size
  const sizeClasses = {
    sm: 'w-24 h-24 max-w-[100px] max-h-[100px]',
    md: 'w-32 h-32 max-w-[130px] max-h-[130px]',
    lg: 'w-36 h-36 max-w-[150px] max-h-[150px]',
  }[size] || 'w-32 h-32 max-w-[130px] max-h-[130px]'

  const colorStyles = {
    blue: {
      border: 'border-blue-700/85',
      innerBorder: 'border-blue-700/75',
      text: 'text-blue-800',
      fill: '#1d4ed8',
      stroke: '#1e40af',
      svgColor: '#1d4ed8',
    },
    navy: {
      border: 'border-blue-900/85',
      innerBorder: 'border-blue-900/75',
      text: 'text-blue-950',
      fill: '#1e3a8a',
      stroke: '#172554',
      svgColor: '#1e3a8a',
    },
    red: {
      border: 'border-red-700/85',
      innerBorder: 'border-red-700/75',
      text: 'text-red-800',
      fill: '#b91c1c',
      stroke: '#991b1b',
      svgColor: '#b91c1c',
    }
  }[color] || {
    border: 'border-blue-700/85',
    innerBorder: 'border-blue-700/75',
    text: 'text-blue-800',
    fill: '#1d4ed8',
    stroke: '#1e40af',
    svgColor: '#1d4ed8',
  }

  // If a custom stamp image is provided, display with natural organic tilt, ink multiply and texture
  if (stampImage) {
    return (
      <div className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}>
        <div className="relative transform -rotate-[6deg] hover:-rotate-[4deg] transition-transform duration-200">
          <img
            src={stampImage}
            alt="Official Company Stamp"
            className={`${sizeClasses} object-contain mix-blend-multiply opacity-95`}
            style={{
              filter: 'contrast(115%) brightness(96%) drop-shadow(0 1px 1px rgba(0,0,0,0.05))',
            }}
          />
        </div>
        <span className="text-[9px] font-semibold text-gray-400/80 mt-1 uppercase tracking-widest text-center">
          {isAr ? 'الختم الرسمي' : 'Official Seal'}
        </span>
      </div>
    )
  }

  // Otherwise render an authentic, rough rubber stamp SVG with circular double rings and distressed texture
  const displayName = companyName || 'OFFICIAL COMPANY SEAL'
  const displayNameAr = companyNameAr || 'الختم الرسمي للمنشأة'

  return (
    <div className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}>
      <div
        className={`relative ${sizeClasses} transform -rotate-[7deg] hover:-rotate-[5deg] transition-transform duration-200 mix-blend-multiply opacity-90`}
        style={{
          filter: 'contrast(120%) brightness(95%)',
        }}
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full drop-shadow-[0_1px_1px_rgba(29,78,216,0.15)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Subtle Ink Grunge Filter */}
          <defs>
            <filter id="rough-stamp-texture" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            {/* Curved Path for Top Text */}
            <path id="top-arc" d="M 28 100 A 72 72 0 0 1 172 100" fill="none" />
            {/* Curved Path for Bottom Text */}
            <path id="bottom-arc" d="M 172 100 A 72 72 0 0 1 28 100" fill="none" />
          </defs>

          <g filter="url(#rough-stamp-texture)">
            {/* Outer Ring with rough distressed stroke */}
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke={colorStyles.svgColor}
              strokeWidth="4"
              strokeDasharray="98 2 120 1"
              strokeLinecap="round"
            />
            {/* Second Outer Thin Ring */}
            <circle
              cx="100"
              cy="100"
              r="85"
              fill="none"
              stroke={colorStyles.svgColor}
              strokeWidth="1.5"
              strokeDasharray="40 1 60 1"
            />

            {/* Inner Dashed Ring */}
            <circle
              cx="100"
              cy="100"
              r="58"
              fill="none"
              stroke={colorStyles.svgColor}
              strokeWidth="2"
              strokeDasharray="5 3"
            />
            <circle
              cx="100"
              cy="100"
              r="53"
              fill="none"
              stroke={colorStyles.svgColor}
              strokeWidth="1"
            />

            {/* Arched Top Text */}
            <text
              fill={colorStyles.svgColor}
              fontSize="10"
              fontWeight="900"
              letterSpacing="2"
              textAnchor="middle"
              className="uppercase"
            >
              <textPath href="#top-arc" startOffset="50%" textAnchor="middle">
                {displayName.length > 28 ? displayName.slice(0, 26) + '..' : displayName}
              </textPath>
            </text>

            {/* Arched Bottom Text (Arabic or Subtitle) */}
            <text
              fill={colorStyles.svgColor}
              fontSize="9.5"
              fontWeight="800"
              letterSpacing="1"
              textAnchor="middle"
              dir="rtl"
            >
              <textPath href="#bottom-arc" startOffset="50%" textAnchor="middle">
                {displayNameAr.length > 28 ? displayNameAr.slice(0, 26) + '..' : displayNameAr}
              </textPath>
            </text>

            {/* Center Section: Stars, Title, Reg Numbers */}
            <g transform="translate(100, 100)" textAnchor="middle">
              {/* Stars */}
              <text y="-24" fill={colorStyles.svgColor} fontSize="10" fontWeight="bold">
                ★ ★ ★
              </text>
              
              {/* Stamp Title */}
              <text y="-8" fill={colorStyles.svgColor} fontSize="11" fontWeight="900" letterSpacing="1">
                OFFICIAL SEAL
              </text>
              <text y="5" fill={colorStyles.svgColor} fontSize="10" fontWeight="900">
                ختم معتمد
              </text>

              {/* CR / VAT Info */}
              {crNumber ? (
                <text y="20" fill={colorStyles.svgColor} fontSize="8" fontWeight="bold">
                  C.R: {crNumber}
                </text>
              ) : vatNumber ? (
                <text y="20" fill={colorStyles.svgColor} fontSize="7.5" fontWeight="bold">
                  VAT: {vatNumber}
                </text>
              ) : (
                <text y="20" fill={colorStyles.svgColor} fontSize="8" fontWeight="bold">
                  VERIFIED
                </text>
              )}
              
              {/* Bottom Mini Star */}
              <text y="33" fill={colorStyles.svgColor} fontSize="7" fontWeight="bold">
                ♦ ♦ ♦
              </text>
            </g>
          </g>
        </svg>
      </div>
      <span className="text-[9px] font-semibold text-gray-400/80 mt-1 uppercase tracking-widest text-center">
        {isAr ? 'الختم الرسمي' : 'Official Seal'}
      </span>
    </div>
  )
}

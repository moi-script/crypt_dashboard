/**
 * CoinGeckoAttribution
 * Required by CoinGecko brand guidelines when displaying their API data.
 *
 * Rules from brand guidelines:
 * - Place near the data, not in footer only
 * - Do NOT hotlink their logo — download SVG from https://www.coingecko.com/en/branding
 * - Link to https://www.coingecko.com or https://www.coingecko.com/en/api
 * - Do NOT claim partnership, endorsement, or collaboration
 *
 * Usage:
 *   <CoinGeckoAttribution />                  — text only
 *   <CoinGeckoAttribution variant="logo" />   — logo + text (download SVG first)
 *   <CoinGeckoAttribution variant="inline" /> — compact for table footers
 */

import React from 'react'

interface Props {
  variant?:   'text' | 'logo' | 'inline'
  className?: string
}

const CG_URL = 'https://www.coingecko.com/en/api'

export function CoinGeckoAttribution({ variant = 'text', className = '' }: Props) {
  if (variant === 'inline') {
    return (
      <a
        href={CG_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`text-xs text-muted-foreground opacity-70 hover:opacity-100 transition-opacity ${className}`}
      >
        Data by CoinGecko
      </a>
    )
  }

  if (variant === 'logo') {
    return (
      <a
        href={CG_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 text-sm text-muted-foreground hover:opacity-80 transition-opacity ${className}`}
        aria-label="Data provided by CoinGecko"
      >
        {/* Download the official SVG from https://www.coingecko.com/en/branding */}
        <img
          src="/assets/coingecko-logo.svg"
          alt="CoinGecko"
          width={20}
          height={20}
          className="shrink-0"
        />
        <span>Data provided by CoinGecko</span>
      </a>
    )
  }

  // default: text
  return (
    <a
      href={CG_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-sm text-muted-foreground hover:opacity-80 transition-opacity underline-offset-2 hover:underline ${className}`}
    >
      Data provided by CoinGecko
    </a>
  )
}

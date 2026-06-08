import React from "react";

interface Props {
  variant?:   "text" | "logo" | "inline";
  className?: string;
}

const CG_URL = "https://www.coingecko.com/en/api";

export function CoinGeckoAttribution({ variant = "text", className = "" }: Props) {
  const baseStyle: React.CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    color: "var(--ink-faint)",
    textDecoration: "none",
    transition: "color 150ms",
  };

  if (variant === "inline") {
    return (
      <a
        href={CG_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={baseStyle}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-faint)"}
      >
        Data: CoinGecko
      </a>
    );
  }

  if (variant === "logo") {
    return (
      <a
        href={CG_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 ${className}`}
        style={baseStyle}
        aria-label="Data provided by CoinGecko"
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-faint)"}
      >
        <img src="/assets/coingecko-logo.svg" alt="CoinGecko" width={16} height={16} className="shrink-0 opacity-50" />
        <span>Data by CoinGecko</span>
      </a>
    );
  }

  return (
    <a
      href={CG_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={baseStyle}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-muted)"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "var(--ink-faint)"}
    >
      Powered by CoinGecko API
    </a>
  );
}
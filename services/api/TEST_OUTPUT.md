BASE_URL=http://localhost:4000
======================================================================
{{BASE_URL}}/api/agent-runs/config

{
    "config": {
        "enabled": false,
        "mode": "paper",
        "loopIntervalMs": 60000,
        "strategies": {
            "yieldHunter": true,
            "rebalance": false,
            "airdropWatch": false
        },
        "watchlist": [
            "bitcoin",
            "ethereum",
            "usd-coin",
            "tether"
        ],
        "maxTradeUsd": 100,
        "requireManualApproval": true
    },
    "schedulerActive": true,
    "keyPresence": {
        "hasBinanceKey": false,
        "hasPrivateKey": false,
        "hasOnchainRpc": false
    }
}


=========================================================================
{{BASE_URL}}/api/agent-runs/config

{
    "ok": true,
    "config": {
        "enabled": true,
        "mode": "paper",
        "loopIntervalMs": 60000,
        "strategies": {
            "yieldHunter": true,
            "rebalance": false,
            "airdropWatch": false
        },
        "watchlist": [
            "bitcoin",
            "ethereum",
            "usd-coin",
            "tether"
        ],
        "maxTradeUsd": 100,
        "requireManualApproval": true
    }
}


=========================================================================
{{BASE_URL}}/api/agent-runs/config


{
    "ok": true,
    "config": {
        "enabled": false,
        "mode": "paper",
        "loopIntervalMs": 60000,
        "strategies": {
            "yieldHunter": true,
            "rebalance": false,
            "airdropWatch": false
        },
        "watchlist": [
            "bitcoin",
            "ethereum",
            "usd-coin",
            "tether"
        ],
        "maxTradeUsd": 100,
        "requireManualApproval": true
    }
}
========================================================================
{{BASE_URL}}/api/chart/history/BTCUSDT

{
    "success": true,
    "data": [
        {
            "_id": "6a2b6a063f1203aa160cdbee",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64163.49,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 2.5,
            "confidence": 55,
            "invalidation": "Daily close above 64163.49 (Camarilla R3) invalidates the bearish bias",
            "framework_scores": {
                "SmartMoney": 70,
                "Wyckoff": 50,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 2,
            "risk_approved": true,
            "adjusted_confidence": 55,
            "adjusted_size_mult": 0.79,
            "risk_warnings": [
                "Reduced size to 79% due to confidence 55"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:08:06.594Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:08:06.604Z",
            "updatedAt": "2026-06-12T02:08:06.604Z",
            "__v": 0
        }
    ],
    "count": 1
}


==========================================================================
{{BASE_URL}}/api/chart/analyze/{{SYMBOL}}


{
    "success": true,
    "data": {
        "primitives_meta": {
            "symbol": "BTCUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T02:08:01.984Z",
            "token_count_estimate": 1119
        },
        "analysis": {
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64163.49,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 2.5,
            "confidence": 55,
            "invalidation": "Daily close above 64163.49 (Camarilla R3) invalidates the bearish bias",
            "reasoning": "The 1D timeframe shows a bearish trend at resistance, overriding the neutral LTF bias. Price is near a strong resistance at 63933.02, with a 4H bearish order block (74092-73222) still unmitigated above. A bullish FVG (63239.43-63270) sits below, offering a short entry zone into the gap. The Wyckoff Phase B accumulation suggests range building, but the HTF bearish bias and proximity to resistance favor a short. The R:R is adequate at 2.5:1 targeting the strong support at 61088.19 and the range low.",
            "framework_scores": {
                "SmartMoney": 70,
                "Wyckoff": 50,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 2,
            "confluence_factors": [
                "HTF bearish trend at resistance (1D)",
                "Price at strong resistance level (63933.02, 3 touches)",
                "Unmitigated bearish order block above (4H)",
                "Bullish FVG below provides short entry zone"
            ]
        },
        "risk": {
            "approved": true,
            "adjusted_confidence": 55,
            "adjusted_size_mult": 0.79,
            "warnings": [
                "Reduced size to 79% due to confidence 55"
            ]
        }
    }
}
===========================================================================
{{BASE_URL}}/api/chart/analyze/{{SYMBOL}}

{
    "success": true,
    "data": {
        "primitives_meta": {
            "symbol": "BTCUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T02:10:05.635Z",
            "token_count_estimate": 1120
        },
        "analysis": {
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + FVG Confluence at Resistance",
            "entry_zone": {
                "high": 64048.57,
                "low": 63933.02
            },
            "stop_loss": 64497.97,
            "take_profit_levels": [
                63239.43,
                62205,
                61088.19
            ],
            "risk_reward": 2.1,
            "confidence": 65,
            "invalidation": "Daily close above 64497.97 (strong resistance) invalidates bearish thesis",
            "reasoning": "The 1D trend is bearish and overrides the neutral LTF bias. Price is at a strong resistance zone (63933-64048) with a bearish unmitigated Order Block above (73222-74092 on 4H) and multiple unfilled bearish FVGs below (64540-65251, 65860-66076). The HTF bearish bias combined with the resistance rejection and unfilled gaps to the downside provides a high-probability short entry. The Wyckoff Phase B accumulation is not yet confirmed with a Spring, so shorting into resistance aligns with the broader downtrend.",
            "framework_scores": {
                "SmartMoney": 85,
                "Wyckoff": 40,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 3,
            "confluence_factors": [
                "HTF bearish trend overrides LTF neutral",
                "Price at strong resistance (63933-64048)",
                "Unmitigated bearish Order Block above",
                "Unfilled bearish FVGs below"
            ]
        },
        "risk": {
            "approved": true,
            "adjusted_confidence": 65,
            "adjusted_size_mult": 0.93,
            "warnings": [
                "Reduced size to 93% due to confidence 65"
            ]
        }
    }
}




{
    "success": true,
    "data": [
        {
            "_id": "6a2b6a823f1203aa160cdbf1",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + FVG Confluence at Resistance",
            "entry_zone": {
                "high": 64048.57,
                "low": 63933.02
            },
            "stop_loss": 64497.97,
            "take_profit_levels": [
                63239.43,
                62205,
                61088.19
            ],
            "risk_reward": 2.1,
            "confidence": 65,
            "invalidation": "Daily close above 64497.97 (strong resistance) invalidates bearish thesis",
            "framework_scores": {
                "SmartMoney": 85,
                "Wyckoff": 40,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 3,
            "risk_approved": true,
            "adjusted_confidence": 65,
            "adjusted_size_mult": 0.93,
            "risk_warnings": [
                "Reduced size to 93% due to confidence 65"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:10:10.442Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:10:10.445Z",
            "updatedAt": "2026-06-12T02:10:10.445Z",
            "__v": 0
        },
        {
            "_id": "6a2b6a063f1203aa160cdbee",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64163.49,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 2.5,
            "confidence": 55,
            "invalidation": "Daily close above 64163.49 (Camarilla R3) invalidates the bearish bias",
            "framework_scores": {
                "SmartMoney": 70,
                "Wyckoff": 50,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 2,
            "risk_approved": true,
            "adjusted_confidence": 55,
            "adjusted_size_mult": 0.79,
            "risk_warnings": [
                "Reduced size to 79% due to confidence 55"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:08:06.594Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:08:06.604Z",
            "updatedAt": "2026-06-12T02:08:06.604Z",
            "__v": 0
        }
    ],
    "count": 2
}

====================================================================
{{BASE_URL}}/api/chart/history/BTCUSDT?limit=10


{
    "success": true,
    "data": [
        {
            "_id": "6a2b6a823f1203aa160cdbf1",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + FVG Confluence at Resistance",
            "entry_zone": {
                "high": 64048.57,
                "low": 63933.02
            },
            "stop_loss": 64497.97,
            "take_profit_levels": [
                63239.43,
                62205,
                61088.19
            ],
            "risk_reward": 2.1,
            "confidence": 65,
            "invalidation": "Daily close above 64497.97 (strong resistance) invalidates bearish thesis",
            "framework_scores": {
                "SmartMoney": 85,
                "Wyckoff": 40,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 3,
            "risk_approved": true,
            "adjusted_confidence": 65,
            "adjusted_size_mult": 0.93,
            "risk_warnings": [
                "Reduced size to 93% due to confidence 65"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:10:10.442Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:10:10.445Z",
            "updatedAt": "2026-06-12T02:10:10.445Z",
            "__v": 0
        },
        {
            "_id": "6a2b6a063f1203aa160cdbee",
            "symbol": "BTCUSDT",
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64163.49,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 2.5,
            "confidence": 55,
            "invalidation": "Daily close above 64163.49 (Camarilla R3) invalidates the bearish bias",
            "framework_scores": {
                "SmartMoney": 70,
                "Wyckoff": 50,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 2,
            "risk_approved": true,
            "adjusted_confidence": 55,
            "adjusted_size_mult": 0.79,
            "risk_warnings": [
                "Reduced size to 79% due to confidence 55"
            ],
            "risk_rejection": null,
            "analyzed_at": "2026-06-12T02:08:06.594Z",
            "timeframes_used": [
                "1h",
                "4h",
                "1d"
            ],
            "btc_bias_at_time": null,
            "createdAt": "2026-06-12T02:08:06.604Z",
            "updatedAt": "2026-06-12T02:08:06.604Z",
            "__v": 0
        }
    ],
    "count": 2
}

===================================================================
{{BASE_URL}}/api/orderblocks/active/BTCUSDT

{
    "success": true,
    "data": [],
    "count": 0
}


// ============================================================
// orderBlock.schema.ts
// Mongoose schema for Order Block zones
// ✅ COMPLETE — do NOT regenerate
// Imported by: orderBlock.model.ts
// ============================================================

import { Schema } from 'mongoose';

const FairValueGapSubSchema = new Schema({
  high:      { type: Number, required: true },
  low:       { type: Number, required: true },
  timestamp: { type: Number, required: true },
  filled:    { type: Boolean, default: false },
  type:      { type: String, enum: ['bullish', 'bearish'], required: true },
}, { _id: false });

export const OrderBlockSchema = new Schema(
  {
    id:               { type: String, required: true, unique: true, index: true },
    symbol:           { type: String, required: true, index: true },
    type:             { type: String, enum: ['bullish', 'bearish'], required: true },
    high:             { type: Number, required: true },
    low:              { type: Number, required: true },
    origin_timestamp: { type: Number, required: true },
    timeframe:        { type: String, required: true, default: '4H' },
    status:           { type: String, enum: ['active', 'mitigated', 'broken'], default: 'active', index: true },
    strength:         { type: Number, min: 0, max: 100, default: 50 },
    associated_fvg:   { type: FairValueGapSubSchema, default: null },
    mitigated_at:     { type: Date, default: null },
  },
  {
    timestamps: true,   // adds createdAt, updatedAt
    collection: 'orderblocks',
  }
);

// Compound index: most common query pattern
OrderBlockSchema.index({ symbol: 1, status: 1, origin_timestamp: -1 });
OrderBlockSchema.index({ symbol: 1, low: 1, high: 1 }); // for price range queries


// chartAnalysis.types.ts

export interface OrderBlock {
  id: string;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  origin_timestamp: number;
  timeframe: string;
  status: 'active' | 'mitigated' | 'broken';
  associated_fvg?: FairValueGap;
  strength: number; // 0-100
}


==================================================================

{{BASE_URL}}/api/orderblocks/sync/BTCUSDT

{
    "success": true,
    "data": [
        {
            "_id": "6a2b70ed3f1203aa160cdc0f",
            "id": "Ri5lwISrUnmmzA2SQj0x7",
            "symbol": "BTCUSDT",
            "type": "bearish",
            "high": 74092,
            "low": 73222,
            "origin_timestamp": 1780272000000,
            "timeframe": "4H",
            "status": "active",
            "strength": 70,
            "associated_fvg": {
                "high": 73222,
                "low": 73095.64,
                "timestamp": 1780300800000,
                "filled": false,
                "type": "bearish"
            },
            "mitigated_at": null,
            "__v": 0,
            "createdAt": "2026-06-12T02:37:33.240Z",
            "updatedAt": "2026-06-12T02:37:33.240Z"
        }
    ],
    "count": 1,
    "synced_at": "2026-06-12T02:37:33.243Z"
}


=======================================================================
{{BASE_URL}}/api/intelligence/scan


{
    "success": true,
    "data": {
        "scan_id": "cZxDiRYCFtFWvV2_Usv3i",
        "generated_at": "2026-06-12T03:02:35.228Z",
        "btc_context": {
            "regime": "ranging",
            "bias": "short",
            "signal_fired_at": "2026-06-12T02:57:59.835Z",
            "signal_type": "Bearish OB + FVG Confluence at Resistance",
            "bos_direction": "bearish",
            "bos_level": 64048.57,
            "dominance": {
                "btc_dominance": 52,
                "eth_dominance": 16,
                "others_dominance": 32,
                "btc_d_trend": "neutral",
                "market_phase": "mixed",
                "sector_leaders": []
            },
            "minutes_since_signal": 0
        },
        "dominance": {
            "btc_dominance": 52,
            "eth_dominance": 16,
            "others_dominance": 32,
            "btc_d_trend": "neutral",
            "market_phase": "mixed",
            "sector_leaders": []
        },
        "market_phase": "mixed",
        "coins": [
            {
                "coin": "AAVE",
                "symbol": "AAVEUSDT",
                "current_price": 64.49,
                "price_change_24h": 2.24,
                "cascade": {
                    "coin": "AAVE",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 6,
                    "window_remaining_minutes": 360,
                    "expected_move_pct": 4.5,
                    "historical_follow_rate": 0.8171
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D) bearish bias overrides LTF neutral",
                    "Unfilled bearish FVG overhead (66.14-63.65)",
                    "BTC context bearish (Bearish OB + FVG Confluence)"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + HTF Resistance Rejection",
                    "entry_zone": {
                        "high": 64.23,
                        "low": 63.65
                    },
                    "stop_loss": 65.5,
                    "take_profit_levels": [
                        62.57,
                        60.33,
                        57.83
                    ],
                    "risk_reward": 2.1,
                    "confidence": 55,
                    "invalidation": "Price closes above 65.45 (1D key level) on the 4H timeframe",
                    "reasoning": "The HTF (1D) is bearish at resistance, overriding the LTF neutral consolidation. A large unfilled bearish FVG (66.14-63.65) remains below current price, acting as a magnet for a retracement. A confirmed bullish BOS at 64.05 suggests a temporary bounce, but the HTF bearish bias and the FVG overhead favor a short from the FVG zone. BTC context is also bearish, reducing overall confidence but adding confluence. The setup targets the FVG fill and then the strong support at 60.33.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 30,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D) bearish bias overrides LTF neutral",
                        "Unfilled bearish FVG overhead (66.14-63.65)",
                        "BTC context bearish (Bearish OB + FVG Confluence)"
                    ]
                },
                "correlation": {
                    "coin": "AAVE",
                    "vs": "BTC",
                    "correlation_30d": 0.8171,
                    "beta_30d": 1.5,
                    "lag_hours": 3,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6226,
                "last_updated": "2026-06-12T03:02:35.228Z"
            },
            {
                "coin": "AVAX",
                "symbol": "AVAXUSDT",
                "current_price": 6.657,
                "price_change_24h": -0.16,
                "cascade": {
                    "coin": "AVAX",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 3,
                    "window_remaining_minutes": 180,
                    "expected_move_pct": 3.74,
                    "historical_follow_rate": 0.8046
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D, 4H) bearish bias at resistance",
                    "Bullish BOS level (6.664) being retested as resistance after sweep",
                    "Unfilled bearish FVGs above price"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + BOS Retest + HTF Resistance Confluence",
                    "entry_zone": {
                        "high": 6.664,
                        "low": 6.62
                    },
                    "stop_loss": 6.707,
                    "take_profit_levels": [
                        6.497,
                        6.419,
                        6.301
                    ],
                    "risk_reward": 2.1,
                    "confidence": 65,
                    "invalidation": "Daily close above 6.707 (swing high) invalidates bearish structure",
                    "reasoning": "The 1D and 4H timeframes are bearish, with price at resistance near 6.6785. A confirmed bullish BOS at 6.664 has been swept by a sell-side liquidity sweep, and price is now retesting that level from below. Three unfilled bearish FVGs above (7.313, 7.567, 8.244) act as resistance magnets. The HTF bearish bias overrides the 1H neutral consolidation, and BTC context is also short, reducing confidence slightly but aligning the overall bearish bias. The entry zone targets a retest of the BOS level with a stop above the recent swing high.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 20,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D, 4H) bearish bias at resistance",
                        "Bullish BOS level (6.664) being retested as resistance after sweep",
                        "Unfilled bearish FVGs above price"
                    ]
                },
                "correlation": {
                    "coin": "AVAX",
                    "vs": "BTC",
                    "correlation_30d": 0.8046,
                    "beta_30d": 1.247,
                    "lag_hours": 1.5,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6207,
                "last_updated": "2026-06-12T03:02:30.216Z"
            },
            {
                "coin": "ARB",
                "symbol": "ARBUSDT",
                "current_price": 0.0834,
                "price_change_24h": 1.09,
                "cascade": {
                    "coin": "ARB",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.58,
                    "historical_follow_rate": 0.7719
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "Unmitigated bullish order block (4H)",
                    "Confirmed bullish BOS",
                    "Buy-side liquidity sweep"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "neutral",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bullish OB + BOS Confluence at HTF Resistance",
                    "entry_zone": {
                        "high": 0.0786,
                        "low": 0.0756
                    },
                    "stop_loss": 0.0749,
                    "take_profit_levels": [
                        0.0802,
                        0.0825,
                        0.0861
                    ],
                    "risk_reward": 2.1,
                    "confidence": 45,
                    "invalidation": "Break below 0.0749 (below the OB low + 1 ATR) invalidates the bullish thesis",
                    "reasoning": "The primary framework is Smart Money. A confirmed bullish BOS at 0.0817 and a buy-side liquidity sweep at 0.0779 indicate institutional interest. An unmitigated bullish order block on the 4H (0.0786-0.0756) provides a clear entry zone. However, the HTF (1D) is bearish and overrides the LTF bullish signal, and BTC context is short, reducing confidence. The setup is a counter-trend bounce within a range, not a trend reversal.",
                    "framework_scores": {
                        "SmartMoney": 70,
                        "Wyckoff": 40,
                        "ElliottWave": 30,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "Unmitigated bullish order block (4H)",
                        "Confirmed bullish BOS",
                        "Buy-side liquidity sweep"
                    ]
                },
                "correlation": {
                    "coin": "ARB",
                    "vs": "BTC",
                    "correlation_30d": 0.7719,
                    "beta_30d": 1.527,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6158,
                "last_updated": "2026-06-12T03:02:31.673Z"
            },
            {
                "coin": "WIF",
                "symbol": "WIFUSDT",
                "current_price": 0.1571,
                "price_change_24h": -1.01,
                "cascade": {
                    "coin": "WIF",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 5.33,
                    "historical_follow_rate": 0.7403
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF bearish trend (1D) overrides LTF",
                    "Unfilled bearish FVG at 0.1607-0.1588",
                    "Strong resistance at 0.15996 with 5 touches",
                    "BTC short bias aligns"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + HTF Resistance Rejection",
                    "entry_zone": {
                        "high": 0.1607,
                        "low": 0.1588
                    },
                    "stop_loss": 0.1625,
                    "take_profit_levels": [
                        0.1549,
                        0.1486,
                        0.1446
                    ],
                    "risk_reward": 2.5,
                    "confidence": 65,
                    "invalidation": "Price closes above 0.1625 on the 4H timeframe",
                    "reasoning": "The HTF (1D) is bearish and overrides the LTF neutral bias, with 2/3 timeframes aligned bearish. A bearish FVG exists at 0.1607-0.1588, unfilled, and price is currently near the strong resistance at 0.15996. The bullish BOS at 0.1557 is recent but the HTF trend remains bearish, suggesting a retracement to fill the FVG before continuation lower. The BTC context is also short, reducing confidence by 20 points but still providing confluence. The setup targets the unmitigated bullish OB at 0.1486-0.1446 and the strong support at 0.1549.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 30,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF bearish trend (1D) overrides LTF",
                        "Unfilled bearish FVG at 0.1607-0.1588",
                        "Strong resistance at 0.15996 with 5 touches",
                        "BTC short bias aligns"
                    ]
                },
                "correlation": {
                    "coin": "WIF",
                    "vs": "BTC",
                    "correlation_30d": 0.7403,
                    "beta_30d": 1.778,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.611,
                "last_updated": "2026-06-12T03:02:32.514Z"
            },
            {
                "coin": "TAO",
                "symbol": "TAOUSDT",
                "current_price": 214.1,
                "price_change_24h": 1.18,
                "cascade": {
                    "coin": "TAO",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.54,
                    "historical_follow_rate": 0.7219
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "Unmitigated bullish OB (4H) at 197.7-203.4",
                    "Confirmed bullish BOS at 214.6",
                    "Buy-side liquidity sweep at 202.5"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "neutral",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bullish OB + BOS Confluence with HTF Bearish Conflict",
                    "entry_zone": {
                        "high": 203.4,
                        "low": 197.7
                    },
                    "stop_loss": 191.4,
                    "take_profit_levels": [
                        214.6,
                        223.5,
                        230.5
                    ],
                    "risk_reward": 2,
                    "confidence": 40,
                    "invalidation": "A 4H close below 197.7 (bullish OB low) invalidates the bullish thesis and confirms HTF bearish continuation.",
                    "reasoning": "The primary framework is Smart Money due to a confirmed bullish BOS at 214.6 and a recent buy-side liquidity sweep at 202.5, which cleared stops before the move up. A large unmitigated bullish Order Block (197.7-203.4) on the 4H provides a strong demand zone for a potential long entry. However, the HTF (1D) is bearish and overrides the LTF bullish signal, creating a significant conflict. The BTC context is also bearish, further reducing confidence. The setup is a counter-trend bounce within a larger downtrend, so risk must be tightly managed.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 20,
                        "ElliottWave": 10,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "Unmitigated bullish OB (4H) at 197.7-203.4",
                        "Confirmed bullish BOS at 214.6",
                        "Buy-side liquidity sweep at 202.5"
                    ]
                },
                "correlation": {
                    "coin": "TAO",
                    "vs": "BTC",
                    "correlation_30d": 0.7219,
                    "beta_30d": 1.514,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6083,
                "last_updated": "2026-06-12T03:02:31.467Z"
            },
            {
                "coin": "MAGIC",
                "symbol": "MAGICUSDT",
                "current_price": 0.0464,
                "price_change_24h": -1.28,
                "cascade": {
                    "coin": "MAGIC",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.16,
                    "historical_follow_rate": 0.7206
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF bearish trend (1D/4H) overrides LTF neutral",
                    "Price at 1D resistance (0.0467) + 0.382 Fib retracement",
                    "BTC short bias aligns with bearish setup"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish OB + FVG Confluence at Resistance",
                    "entry_zone": {
                        "high": 0.0467,
                        "low": 0.0464
                    },
                    "stop_loss": 0.0474,
                    "take_profit_levels": [
                        0.0458,
                        0.0452,
                        0.0448
                    ],
                    "risk_reward": 2,
                    "confidence": 55,
                    "invalidation": "Price breaks and closes above 0.0474 (swing high) with strong momentum",
                    "reasoning": "The HTF (1D/4H) is bearish and overrides the LTF neutral bias. A confirmed bullish BOS at 0.0464 has already occurred, but price is now approaching the 1D resistance at 0.0467, which aligns with the 0.382 Fibonacci retracement of the recent swing. The unmitigated bearish order block at 0.0659 and unfilled bearish FVGs above provide strong resistance overhead. BTC context is short, reinforcing the bearish bias. The setup targets a retracement back toward the 0.0448 liquidity sweep level.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 40,
                        "ElliottWave": 50,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF bearish trend (1D/4H) overrides LTF neutral",
                        "Price at 1D resistance (0.0467) + 0.382 Fib retracement",
                        "BTC short bias aligns with bearish setup"
                    ]
                },
                "correlation": {
                    "coin": "MAGIC",
                    "vs": "BTC",
                    "correlation_30d": 0.7206,
                    "beta_30d": 1.388,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6081,
                "last_updated": "2026-06-12T03:02:33.872Z"
            },
            {
                "coin": "APT",
                "symbol": "APTUSDT",
                "current_price": 0.65,
                "price_change_24h": -2.69,
                "cascade": {
                    "coin": "APT",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.75,
                    "historical_follow_rate": 0.7095
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D) bearish trend overrides LTF neutral",
                    "Price near 0.786 Fibonacci retracement (0.6479) from the 0.607-0.659 swing",
                    "Unfilled bearish FVG overhead (0.673-0.677) acting as resistance",
                    "BTC context bearish (short bias, bearish BOS)"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Sell-Side Liquidity Sweep + Bearish FVG Overhead",
                    "entry_zone": {
                        "high": 0.6479,
                        "low": 0.643
                    },
                    "stop_loss": 0.6595,
                    "take_profit_levels": [
                        0.637,
                        0.623,
                        0.607
                    ],
                    "risk_reward": 2.24,
                    "confidence": 55,
                    "invalidation": "Price breaks and closes above 0.659 (swing high), invalidating the bearish structure.",
                    "reasoning": "The HTF (1D) is bearish and overrides the LTF neutral bias. A confirmed bullish BOS at 0.643 was preceded by a sell-side liquidity sweep at the same level, trapping shorts before the move up. However, price is now approaching the unfilled bearish FVG at 0.673-0.677 and the 0.786 Fibonacci retracement at 0.6479, which aligns with the 1H consolidation resistance. The Wyckoff Phase B accumulation suggests a potential spring near 0.61, but the current structure favors a short from the retracement zone into the FVG, targeting the support cluster at 0.637 and 0.623. BTC context is bearish, adding confluence.",
                    "framework_scores": {
                        "SmartMoney": 70,
                        "Wyckoff": 40,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D) bearish trend overrides LTF neutral",
                        "Price near 0.786 Fibonacci retracement (0.6479) from the 0.607-0.659 swing",
                        "Unfilled bearish FVG overhead (0.673-0.677) acting as resistance",
                        "BTC context bearish (short bias, bearish BOS)"
                    ]
                },
                "correlation": {
                    "coin": "APT",
                    "vs": "BTC",
                    "correlation_30d": 0.7095,
                    "beta_30d": 1.582,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6064,
                "last_updated": "2026-06-12T03:02:34.736Z"
            },
            {
                "coin": "OP",
                "symbol": "OPUSDT",
                "current_price": 0.0962,
                "price_change_24h": -0.62,
                "cascade": {
                    "coin": "OP",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 5.12,
                    "historical_follow_rate": 0.7011
                },
                "confluence_score": 4,
                "confluence_factors": [
                    "HTF (1D/4H) bearish bias overrides LTF",
                    "Bearish BOS confirmed at 0.0929",
                    "Price at 0.786 Fibonacci retracement of the bearish swing",
                    "BTC context bearish with Bearish OB + FVG signal"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish BOS + Unmitigated Bearish OB + FVG Confluence",
                    "entry_zone": {
                        "high": 0.0965,
                        "low": 0.0959
                    },
                    "stop_loss": 0.0985,
                    "take_profit_levels": [
                        0.0929,
                        0.0918,
                        0.0887
                    ],
                    "risk_reward": 2.5,
                    "confidence": 65,
                    "invalidation": "Price breaks and closes above 0.0985 (above the bearish OB high and recent swing high)",
                    "reasoning": "The HTF (1D/4H) is bearish, overriding the LTF neutral consolidation. A confirmed bearish BOS at 0.0929 has been swept multiple times, indicating liquidity grabs. Price is now retracing into the 0.786 Fib level (0.09585) and a bearish FVG (0.1026-0.1002) remains unfilled above. The 4H bearish OB (0.1425-0.1407) is distant but reinforces the bearish structure. The entry zone targets the 1H resistance area near the 0.786 Fib and the 4H key level, offering a high-probability short with a tight stop above the recent swing high. BTC context is also bearish, adding confluence.",
                    "framework_scores": {
                        "SmartMoney": 85,
                        "Wyckoff": 40,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 4,
                    "confluence_factors": [
                        "HTF (1D/4H) bearish bias overrides LTF",
                        "Bearish BOS confirmed at 0.0929",
                        "Price at 0.786 Fibonacci retracement of the bearish swing",
                        "BTC context bearish with Bearish OB + FVG signal"
                    ]
                },
                "correlation": {
                    "coin": "OP",
                    "vs": "BTC",
                    "correlation_30d": 0.7011,
                    "beta_30d": 1.708,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6052,
                "last_updated": "2026-06-12T03:02:33.190Z"
            }
        ],
        "total_analyzed": 23,
        "windows_open": 20,
        "top_opportunities": [
            {
                "coin": "AAVE",
                "symbol": "AAVEUSDT",
                "current_price": 64.49,
                "price_change_24h": 2.24,
                "cascade": {
                    "coin": "AAVE",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 6,
                    "window_remaining_minutes": 360,
                    "expected_move_pct": 4.5,
                    "historical_follow_rate": 0.8171
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D) bearish bias overrides LTF neutral",
                    "Unfilled bearish FVG overhead (66.14-63.65)",
                    "BTC context bearish (Bearish OB + FVG Confluence)"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + HTF Resistance Rejection",
                    "entry_zone": {
                        "high": 64.23,
                        "low": 63.65
                    },
                    "stop_loss": 65.5,
                    "take_profit_levels": [
                        62.57,
                        60.33,
                        57.83
                    ],
                    "risk_reward": 2.1,
                    "confidence": 55,
                    "invalidation": "Price closes above 65.45 (1D key level) on the 4H timeframe",
                    "reasoning": "The HTF (1D) is bearish at resistance, overriding the LTF neutral consolidation. A large unfilled bearish FVG (66.14-63.65) remains below current price, acting as a magnet for a retracement. A confirmed bullish BOS at 64.05 suggests a temporary bounce, but the HTF bearish bias and the FVG overhead favor a short from the FVG zone. BTC context is also bearish, reducing overall confidence but adding confluence. The setup targets the FVG fill and then the strong support at 60.33.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 30,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D) bearish bias overrides LTF neutral",
                        "Unfilled bearish FVG overhead (66.14-63.65)",
                        "BTC context bearish (Bearish OB + FVG Confluence)"
                    ]
                },
                "correlation": {
                    "coin": "AAVE",
                    "vs": "BTC",
                    "correlation_30d": 0.8171,
                    "beta_30d": 1.5,
                    "lag_hours": 3,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6226,
                "last_updated": "2026-06-12T03:02:35.228Z"
            },
            {
                "coin": "AVAX",
                "symbol": "AVAXUSDT",
                "current_price": 6.657,
                "price_change_24h": -0.16,
                "cascade": {
                    "coin": "AVAX",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 3,
                    "window_remaining_minutes": 180,
                    "expected_move_pct": 3.74,
                    "historical_follow_rate": 0.8046
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF (1D, 4H) bearish bias at resistance",
                    "Bullish BOS level (6.664) being retested as resistance after sweep",
                    "Unfilled bearish FVGs above price"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + BOS Retest + HTF Resistance Confluence",
                    "entry_zone": {
                        "high": 6.664,
                        "low": 6.62
                    },
                    "stop_loss": 6.707,
                    "take_profit_levels": [
                        6.497,
                        6.419,
                        6.301
                    ],
                    "risk_reward": 2.1,
                    "confidence": 65,
                    "invalidation": "Daily close above 6.707 (swing high) invalidates bearish structure",
                    "reasoning": "The 1D and 4H timeframes are bearish, with price at resistance near 6.6785. A confirmed bullish BOS at 6.664 has been swept by a sell-side liquidity sweep, and price is now retesting that level from below. Three unfilled bearish FVGs above (7.313, 7.567, 8.244) act as resistance magnets. The HTF bearish bias overrides the 1H neutral consolidation, and BTC context is also short, reducing confidence slightly but aligning the overall bearish bias. The entry zone targets a retest of the BOS level with a stop above the recent swing high.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 20,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF (1D, 4H) bearish bias at resistance",
                        "Bullish BOS level (6.664) being retested as resistance after sweep",
                        "Unfilled bearish FVGs above price"
                    ]
                },
                "correlation": {
                    "coin": "AVAX",
                    "vs": "BTC",
                    "correlation_30d": 0.8046,
                    "beta_30d": 1.247,
                    "lag_hours": 1.5,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6207,
                "last_updated": "2026-06-12T03:02:30.216Z"
            },
            {
                "coin": "ARB",
                "symbol": "ARBUSDT",
                "current_price": 0.0834,
                "price_change_24h": 1.09,
                "cascade": {
                    "coin": "ARB",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.58,
                    "historical_follow_rate": 0.7719
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "Unmitigated bullish order block (4H)",
                    "Confirmed bullish BOS",
                    "Buy-side liquidity sweep"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "neutral",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bullish OB + BOS Confluence at HTF Resistance",
                    "entry_zone": {
                        "high": 0.0786,
                        "low": 0.0756
                    },
                    "stop_loss": 0.0749,
                    "take_profit_levels": [
                        0.0802,
                        0.0825,
                        0.0861
                    ],
                    "risk_reward": 2.1,
                    "confidence": 45,
                    "invalidation": "Break below 0.0749 (below the OB low + 1 ATR) invalidates the bullish thesis",
                    "reasoning": "The primary framework is Smart Money. A confirmed bullish BOS at 0.0817 and a buy-side liquidity sweep at 0.0779 indicate institutional interest. An unmitigated bullish order block on the 4H (0.0786-0.0756) provides a clear entry zone. However, the HTF (1D) is bearish and overrides the LTF bullish signal, and BTC context is short, reducing confidence. The setup is a counter-trend bounce within a range, not a trend reversal.",
                    "framework_scores": {
                        "SmartMoney": 70,
                        "Wyckoff": 40,
                        "ElliottWave": 30,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "Unmitigated bullish order block (4H)",
                        "Confirmed bullish BOS",
                        "Buy-side liquidity sweep"
                    ]
                },
                "correlation": {
                    "coin": "ARB",
                    "vs": "BTC",
                    "correlation_30d": 0.7719,
                    "beta_30d": 1.527,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6158,
                "last_updated": "2026-06-12T03:02:31.673Z"
            },
            {
                "coin": "WIF",
                "symbol": "WIFUSDT",
                "current_price": 0.1571,
                "price_change_24h": -1.01,
                "cascade": {
                    "coin": "WIF",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 5.33,
                    "historical_follow_rate": 0.7403
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "HTF bearish trend (1D) overrides LTF",
                    "Unfilled bearish FVG at 0.1607-0.1588",
                    "Strong resistance at 0.15996 with 5 touches",
                    "BTC short bias aligns"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "short",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bearish FVG + HTF Resistance Rejection",
                    "entry_zone": {
                        "high": 0.1607,
                        "low": 0.1588
                    },
                    "stop_loss": 0.1625,
                    "take_profit_levels": [
                        0.1549,
                        0.1486,
                        0.1446
                    ],
                    "risk_reward": 2.5,
                    "confidence": 65,
                    "invalidation": "Price closes above 0.1625 on the 4H timeframe",
                    "reasoning": "The HTF (1D) is bearish and overrides the LTF neutral bias, with 2/3 timeframes aligned bearish. A bearish FVG exists at 0.1607-0.1588, unfilled, and price is currently near the strong resistance at 0.15996. The bullish BOS at 0.1557 is recent but the HTF trend remains bearish, suggesting a retracement to fill the FVG before continuation lower. The BTC context is also short, reducing confidence by 20 points but still providing confluence. The setup targets the unmitigated bullish OB at 0.1486-0.1446 and the strong support at 0.1549.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 30,
                        "ElliottWave": 0,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "HTF bearish trend (1D) overrides LTF",
                        "Unfilled bearish FVG at 0.1607-0.1588",
                        "Strong resistance at 0.15996 with 5 touches",
                        "BTC short bias aligns"
                    ]
                },
                "correlation": {
                    "coin": "WIF",
                    "vs": "BTC",
                    "correlation_30d": 0.7403,
                    "beta_30d": 1.778,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.611,
                "last_updated": "2026-06-12T03:02:32.514Z"
            },
            {
                "coin": "TAO",
                "symbol": "TAOUSDT",
                "current_price": 214.1,
                "price_change_24h": 1.18,
                "cascade": {
                    "coin": "TAO",
                    "status": "window_open",
                    "btc_signal_ts": "2026-06-12T02:57:59.835Z",
                    "minutes_elapsed": 0,
                    "expected_window_hours": 4,
                    "window_remaining_minutes": 240,
                    "expected_move_pct": 4.54,
                    "historical_follow_rate": 0.7219
                },
                "confluence_score": 3,
                "confluence_factors": [
                    "Unmitigated bullish OB (4H) at 197.7-203.4",
                    "Confirmed bullish BOS at 214.6",
                    "Buy-side liquidity sweep at 202.5"
                ],
                "analysis": {
                    "regime": "ranging",
                    "bias": "neutral",
                    "primary_framework": "SmartMoney",
                    "setup_name": "Bullish OB + BOS Confluence with HTF Bearish Conflict",
                    "entry_zone": {
                        "high": 203.4,
                        "low": 197.7
                    },
                    "stop_loss": 191.4,
                    "take_profit_levels": [
                        214.6,
                        223.5,
                        230.5
                    ],
                    "risk_reward": 2,
                    "confidence": 40,
                    "invalidation": "A 4H close below 197.7 (bullish OB low) invalidates the bullish thesis and confirms HTF bearish continuation.",
                    "reasoning": "The primary framework is Smart Money due to a confirmed bullish BOS at 214.6 and a recent buy-side liquidity sweep at 202.5, which cleared stops before the move up. A large unmitigated bullish Order Block (197.7-203.4) on the 4H provides a strong demand zone for a potential long entry. However, the HTF (1D) is bearish and overrides the LTF bullish signal, creating a significant conflict. The BTC context is also bearish, further reducing confidence. The setup is a counter-trend bounce within a larger downtrend, so risk must be tightly managed.",
                    "framework_scores": {
                        "SmartMoney": 75,
                        "Wyckoff": 20,
                        "ElliottWave": 10,
                        "Harmonic": 0
                    },
                    "confluence_score": 3,
                    "confluence_factors": [
                        "Unmitigated bullish OB (4H) at 197.7-203.4",
                        "Confirmed bullish BOS at 214.6",
                        "Buy-side liquidity sweep at 202.5"
                    ]
                },
                "correlation": {
                    "coin": "TAO",
                    "vs": "BTC",
                    "correlation_30d": 0.7219,
                    "beta_30d": 1.514,
                    "lag_hours": 2,
                    "is_leading": false,
                    "is_lagging": false
                },
                "historical_setup_accuracy": 0.65,
                "historical_sample_size": 0,
                "opportunity_score": 0.6083,
                "last_updated": "2026-06-12T03:02:31.467Z"
            }
        ]
    },
    "cached": false
}



==============================================================
{{BASE_URL}}/api/intelligence/cascade


{
    "success": true,
    "data": {
        "scan_id": "cZxDiRYCFtFWvV2_Usv3i",
        "generated_at": "2026-06-12T03:02:35.228Z",
        "btc_signal": {
            "type": "Bearish OB + FVG Confluence at Resistance",
            "fired_at": "2026-06-12T02:57:59.835Z",
            "bias": "short"
        },
        "windows_open": 20,
        "coins": [
            {
                "symbol": "AAVE",
                "cascade_status": "window_open",
                "window_remaining_minutes": 360,
                "expected_move_pct": 4.5,
                "historical_follow_rate": 0.8171,
                "opportunity_score": 0.6226,
                "current_price": 64.49,
                "price_change_24h": 2.24
            },
            {
                "symbol": "AVAX",
                "cascade_status": "window_open",
                "window_remaining_minutes": 180,
                "expected_move_pct": 3.74,
                "historical_follow_rate": 0.8046,
                "opportunity_score": 0.6207,
                "current_price": 6.657,
                "price_change_24h": -0.16
            },
            {
                "symbol": "ARB",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 4.58,
                "historical_follow_rate": 0.7719,
                "opportunity_score": 0.6158,
                "current_price": 0.0834,
                "price_change_24h": 1.09
            },
            {
                "symbol": "WIF",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 5.33,
                "historical_follow_rate": 0.7403,
                "opportunity_score": 0.611,
                "current_price": 0.1571,
                "price_change_24h": -1.01
            },
            {
                "symbol": "TAO",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 4.54,
                "historical_follow_rate": 0.7219,
                "opportunity_score": 0.6083,
                "current_price": 214.1,
                "price_change_24h": 1.18
            },
            {
                "symbol": "MAGIC",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 4.16,
                "historical_follow_rate": 0.7206,
                "opportunity_score": 0.6081,
                "current_price": 0.0464,
                "price_change_24h": -1.28
            },
            {
                "symbol": "APT",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 4.75,
                "historical_follow_rate": 0.7095,
                "opportunity_score": 0.6064,
                "current_price": 0.65,
                "price_change_24h": -2.69
            },
            {
                "symbol": "OP",
                "cascade_status": "window_open",
                "window_remaining_minutes": 240,
                "expected_move_pct": 5.12,
                "historical_follow_rate": 0.7011,
                "opportunity_score": 0.6052,
                "current_price": 0.0962,
                "price_change_24h": -0.62
            }
        ]
    }
}


============================================================
{{BASE_URL}}/api/agent-runs?limit=10&status=completed



{
    "runs": [
        {
            "_id": "6a2b80133f1203aa160cdc43",
            "runId": "run-1PfLZD8oBo",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:42:11.053Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:42:11.056Z",
            "updatedAt": "2026-06-12T03:43:41.600Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:43:41.599Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:43:41.598Z"
            }
        },
        {
            "_id": "6a2b7fd73f1203aa160cdc42",
            "runId": "run-J79bQ2fASo",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:41:11.051Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:41:11.052Z",
            "updatedAt": "2026-06-12T03:42:10.457Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:42:10.456Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "No compelling trade opportunity. Top pool (WHYPE-USDC 160% APY) is on Hyperliquid L1 with all reward APY — high bridging/contract risk and no data on WHYPE. Next best (WETH-USDC on Base, 83.65% APY, $97.8M TVL) is solid but ETH is in bearish HTF structure at resistance ($1,670) — entering a concentrated LP now risks IL from a potential ETH decline. No APY anomalies detected this cycle. Better to wait for clearer directional alignment or a yield anomaly signal."
                },
                "confidence": 90,
                "reasoning": "No compelling trade opportunity. Top pool (WHYPE-USDC 160% APY) is on Hyperliquid L1 with all reward APY — high bridging/contract risk and no data on WHYPE. Next best (WETH-USDC on Base, 83.65% APY, $97.8M TVL) is solid but ETH is in bearish HTF structure at resistance ($1,670) — entering a concentrated LP now risks IL from a potential ETH decline. No APY anomalies detected this cycle. Better to wait for clearer directional alignment or a yield anomaly signal.",
                "toolCallTrace": [
                    "get_price",
                    "get_wallet_state",
                    "get_token_volume",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_price",
                    "no_action"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:42:10.456Z"
            }
        },
        {
            "_id": "6a2b7f233f1203aa160cdc40",
            "runId": "run-22lTTRmdC-",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:38:11.020Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:38:11.023Z",
            "updatedAt": "2026-06-12T03:39:32.528Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:39:32.528Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_price",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_confluence_zones",
                    "get_confluence_zones",
                    "get_yields"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:39:32.528Z"
            }
        },
        {
            "_id": "6a2b7e333f1203aa160cdc3d",
            "runId": "run-TK5-LXyRML",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:34:11.005Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:34:11.009Z",
            "updatedAt": "2026-06-12T03:35:20.557Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:35:20.556Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Market conditions are unfavorable for yield entry: BTC and ETH both show conflicted multi-timeframe bias with bearish HTF overriding neutral LTF (1W/1D bearish at resistance). No yield anomaly spikes detected this cycle. The top pool (nest-cl/Hyperliquid 160% APY) is on a niche chain with 100% reward-based yield — unsustainable. Uniswap-v3 WETH-USDC (83.65% APY, $97.8M TVL) is tempting but entering when ETH is at resistance ($1,695) with bearish weekly/daily structure risks impermanent loss. Best action: stay in USDC and wait for clearer conditions."
                },
                "confidence": 90,
                "reasoning": "Market conditions are unfavorable for yield entry: BTC and ETH both show conflicted multi-timeframe bias with bearish HTF overriding neutral LTF (1W/1D bearish at resistance). No yield anomaly spikes detected this cycle. The top pool (nest-cl/Hyperliquid 160% APY) is on a niche chain with 100% reward-based yield — unsustainable. Uniswap-v3 WETH-USDC (83.65% APY, $97.8M TVL) is tempting but entering when ETH is at resistance ($1,695) with bearish weekly/daily structure risks impermanent loss. Best action: stay in USDC and wait for clearer conditions.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "no_action"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:35:20.556Z"
            }
        },
        {
            "_id": "6a2b7dbb3f1203aa160cdc3c",
            "runId": "run-2EDcL5hLiF",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:32:11.001Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:32:11.004Z",
            "updatedAt": "2026-06-12T03:33:11.235Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:33:11.235Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_price",
                    "get_price",
                    "get_token_volume",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_yields",
                    "get_yields"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:33:11.235Z"
            }
        },
        {
            "_id": "6a2b7c8e3f1203aa160cdc35",
            "runId": "run-uGGoVojfEZ",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:27:10.959Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:27:10.963Z",
            "updatedAt": "2026-06-12T03:28:49.169Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:28:49.169Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_price",
                    "get_token_volume",
                    "get_wallet_state",
                    "get_price",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_token_volume",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "get_yields"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:28:49.168Z"
            }
        },
        {
            "_id": "6a2b7c163f1203aa160cdc33",
            "runId": "run-wcQYybXJ51",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:25:10.941Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:25:10.944Z",
            "updatedAt": "2026-06-12T03:26:10.995Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:26:10.995Z",
            "decision": {
                "intent": {
                    "type": "set_alert",
                    "rationale": "ETH breaking above $1750 would signal HTF bullish reversal, making the 83.65% APY uniswap-v3 WETH-USDC pool on Base ($97.8M TVL) a safer LP entry. Currently ETH is at $1,668 with bearish HTF overriding neutral LTF — waiting for alignment.",
                    "coinId": "ethereum",
                    "condition": "above",
                    "threshold": 1750
                },
                "confidence": 80,
                "reasoning": "ETH breaking above $1750 would signal HTF bullish reversal, making the 83.65% APY uniswap-v3 WETH-USDC pool on Base ($97.8M TVL) a safer LP entry. Currently ETH is at $1,668 with bearish HTF overriding neutral LTF — waiting for alignment.",
                "toolCallTrace": [
                    "get_price",
                    "get_token_volume",
                    "get_wallet_state",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "set_alert"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:26:10.990Z"
            }
        },
        {
            "_id": "6a2b7bda3f1203aa160cdc31",
            "runId": "run-ceVUPXOc2y",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:24:10.942Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:24:10.944Z",
            "updatedAt": "2026-06-12T03:24:51.100Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:24:51.099Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_news_sentiment",
                    "get_price",
                    "get_price",
                    "get_token_volume",
                    "get_token_volume",
                    "get_full_htf_context",
                    "check_timeframe_alignment"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:24:51.098Z"
            }
        },
        {
            "_id": "6a2b7b263f1203aa160cdc2d",
            "runId": "run-W16XvQEZjJ",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:21:10.911Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:21:10.913Z",
            "updatedAt": "2026-06-12T03:22:23.049Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:22:23.049Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Market structure is conflicted — BTC and ETH both show HTF (1D/1W) bearish overriding LTF neutral signals, with no timeframe alignment. No APY anomalies detected this cycle. The top pool (WHYPE-USDC at 133%) is on a niche chain with low TVL ($7.5M) and illiquid token. The safest high-yield pool (Uniswap V3 WETH-USDC on Base, $97M TVL, 85.6% APY) carries impermanent loss risk in a bearish ETH environment. No compelling risk-adjusted opportunity warrants action right now."
                },
                "confidence": 90,
                "reasoning": "Market structure is conflicted — BTC and ETH both show HTF (1D/1W) bearish overriding LTF neutral signals, with no timeframe alignment. No APY anomalies detected this cycle. The top pool (WHYPE-USDC at 133%) is on a niche chain with low TVL ($7.5M) and illiquid token. The safest high-yield pool (Uniswap V3 WETH-USDC on Base, $97M TVL, 85.6% APY) carries impermanent loss risk in a bearish ETH environment. No compelling risk-adjusted opportunity warrants action right now.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_yields",
                    "get_token_volume",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "check_timeframe_alignment",
                    "check_timeframe_alignment",
                    "no_action"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:22:23.049Z"
            }
        },
        {
            "_id": "6a2b7aae3f1203aa160cdc2c",
            "runId": "run-Nx8fDaRS_6",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:19:10.889Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:19:10.893Z",
            "updatedAt": "2026-06-12T03:20:12.029Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:20:12.028Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "Reached 5 read iterations without a clear signal."
                },
                "confidence": 90,
                "reasoning": "Reached 5 read iterations without a clear signal.",
                "toolCallTrace": [
                    "get_price",
                    "get_token_volume",
                    "get_wallet_state",
                    "get_price",
                    "get_yields",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_token_volume",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_yields"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:20:12.028Z"
            }
        }
    ],
    "total": 10
}

{{BASE_URL}}/api/agent-runs/:runId


{
    "_id": "6a2b7aae3f1203aa160cdc2c",
    "runId": "run-Nx8fDaRS_6",
    "strategy": "yieldHunter",
    "mode": "paper",
    "startedAt": "2026-06-12T03:19:10.889Z",
    "status": "completed",
    "contextSnapshot": "=== AGENT CONTEXT | 2026-06-12T03:19:13.555Z ===\nStrategy: yieldHunter\n\nWALLET (paper): USDC: $5000.00 | Total: $5000.00 | Today PnL: +$0.00 | Open positions: 0\n\n=== YIELD HUNTER — 2026-06-12T03:19:13.554Z ===\nScanned 334 USDC/stablecoin pools (TVL ≥ $5M)\n\nTOP 10 POOLS BY APY:\n  nest-cl/Hyperliquid L1 (WHYPE-USDC): 133.21% APY, TVL $7.5M\n  aerodrome-slipstream/Base (USDC-CBBTC): 112.1% APY, TVL $9.1M\n  uniswap-v3/Base (WETH-USDC): 85.64% APY, TVL $97.4M\n  gmtrade/Solana (XAU-USDC): 84.22% APY, TVL $6.3M\n  raydium-amm/Solana (WSOL-USDC): 80.2% APY, TVL $7.9M\n  uniswap-v4/Arbitrum (DORY-USDC): 79.6% APY, TVL $11.7M\n  aerodrome-slipstream/Base (WETH-USDC): 78.07% APY, TVL $8.2M\n  minswap-dex/Cardano (NIGHT-USDCX): 76.5% APY, TVL $5.8M\n  pharaoh-v3/Avalanche (USDT-USDC): 72.31% APY, TVL $11.0M\n  orca-dex/Solana (SOL-USDC): 54.46% APY, TVL $22.8M\n\nANOMALIES (APY spike > 5pt vs 7d avg):\n  None detected this cycle.",
    "createdAt": "2026-06-12T03:19:10.893Z",
    "updatedAt": "2026-06-12T03:20:12.029Z",
    "__v": 0,
    "completedAt": "2026-06-12T03:20:12.028Z",
    "decision": {
        "intent": {
            "type": "no_action",
            "rationale": "Reached 5 read iterations without a clear signal."
        },
        "confidence": 90,
        "reasoning": "Reached 5 read iterations without a clear signal.",
        "toolCallTrace": [
            "get_price",
            "get_token_volume",
            "get_wallet_state",
            "get_price",
            "get_yields",
            "get_token_volume",
            "get_token_volume",
            "get_token_volume",
            "get_token_volume",
            "get_news_sentiment",
            "get_news_sentiment",
            "get_news_sentiment",
            "get_full_htf_context",
            "get_full_htf_context",
            "get_full_htf_context",
            "get_yields"
        ]
    },
    "executionResult": {
        "status": "filled",
        "simulatedPnlUsd": 0,
        "executedAt": "2026-06-12T03:20:12.028Z"
    }
}

=================================================================

{{BASE_URL}}/api/agent-runs/trigger


response {
    "triggered": true,
    "waited": false
}




================================================

{{BASE_URL}}/api/opportunities



{
    "opportunities": [
        {
            "_id": "6a2b7d073f1203aa160cdc38",
            "opportunityId": "opp-run-y8yriZGZSI-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-y8yriZGZSI",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 7.66pt above 7d avg (152.36%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 88,
            "acted": false,
            "detectedAt": "2026-06-12T03:29:11.318Z",
            "expiresAt": "2026-06-13T03:29:11.318Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 152.36,
                "spikePct": 7.66
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:29:11.318Z",
            "updatedAt": "2026-06-12T03:29:11.318Z"
        },
        {
            "_id": "6a2b7c8f3f1203aa160cdc36",
            "opportunityId": "opp-run-uGGoVojfEZ-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-uGGoVojfEZ",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 11.49pt above 7d avg (148.53%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T03:27:11.704Z",
            "expiresAt": "2026-06-13T03:27:11.704Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 148.53,
                "spikePct": 11.49
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:27:11.706Z",
            "updatedAt": "2026-06-12T03:27:11.706Z"
        },
        {
            "_id": "6a2b7c173f1203aa160cdc34",
            "opportunityId": "opp-run-wcQYybXJ51-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-wcQYybXJ51",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 15.32pt above 7d avg (144.7%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T03:25:11.682Z",
            "expiresAt": "2026-06-13T03:25:11.682Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 144.7,
                "spikePct": 15.32
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:25:11.683Z",
            "updatedAt": "2026-06-12T03:25:11.683Z"
        },
        {
            "_id": "6a2b7bdb3f1203aa160cdc32",
            "opportunityId": "opp-run-ceVUPXOc2y-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-ceVUPXOc2y",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 19.15pt above 7d avg (140.87%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T03:24:11.985Z",
            "expiresAt": "2026-06-13T03:24:11.985Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 140.87,
                "spikePct": 19.15
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:24:11.986Z",
            "updatedAt": "2026-06-12T03:24:11.986Z"
        },
        {
            "_id": "6a2b7b9f3f1203aa160cdc2f",
            "opportunityId": "opp-run-55l0jCqAhI-afe2c8c8",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-55l0jCqAhI",
            "title": "nest-cl/Hyperliquid L1 APY spike: 160.02%",
            "detail": "WHYPE-USDC APY jumped 22.98pt above 7d avg (137.04%). TVL: $7.6M.",
            "asset": "WHYPE-USDC",
            "protocol": "nest-cl",
            "chain": "Hyperliquid L1",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T03:23:11.820Z",
            "expiresAt": "2026-06-13T03:23:11.819Z",
            "metadata": {
                "pool": "afe2c8c8-2ab8-4f1b-abda-a8a12718c431",
                "protocol": "nest-cl",
                "chain": "Hyperliquid L1",
                "symbol": "WHYPE-USDC",
                "apyPct": 160.02,
                "tvlUsd": 7554342,
                "apyBase": null,
                "apyReward": 160.0246,
                "avg7dApyPct": 137.04,
                "spikePct": 22.98
            },
            "__v": 0,
            "createdAt": "2026-06-12T03:23:11.822Z",
            "updatedAt": "2026-06-12T03:23:11.822Z"
        },
        {
            "_id": "6a2b6ef63f1203aa160cdc09",
            "opportunityId": "opp-run-_dv4pf_oOO-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-_dv4pf_oOO",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 7.15pt above 7d avg (65.16%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 86,
            "acted": false,
            "detectedAt": "2026-06-12T02:29:10.898Z",
            "expiresAt": "2026-06-13T02:29:10.898Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 65.16,
                "spikePct": 7.15
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:29:10.899Z",
            "updatedAt": "2026-06-12T02:29:10.899Z"
        },
        {
            "_id": "6a2b6ef63f1203aa160cdc0a",
            "opportunityId": "opp-run-_dv4pf_oOO-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-_dv4pf_oOO",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 6.65pt above 7d avg (27.02%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 83,
            "acted": false,
            "detectedAt": "2026-06-12T02:29:10.898Z",
            "expiresAt": "2026-06-13T02:29:10.898Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 27.02,
                "spikePct": 6.65
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:29:10.899Z",
            "updatedAt": "2026-06-12T02:29:10.899Z"
        },
        {
            "_id": "6a2b6eba3f1203aa160cdc06",
            "opportunityId": "opp-run-JhXiSdxCsh-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-JhXiSdxCsh",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 10.73pt above 7d avg (61.58%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:28:10.952Z",
            "expiresAt": "2026-06-13T02:28:10.952Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 61.58,
                "spikePct": 10.73
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:28:10.953Z",
            "updatedAt": "2026-06-12T02:28:10.953Z"
        },
        {
            "_id": "6a2b6eba3f1203aa160cdc07",
            "opportunityId": "opp-run-JhXiSdxCsh-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-JhXiSdxCsh",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 9.97pt above 7d avg (23.7%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:28:10.952Z",
            "expiresAt": "2026-06-13T02:28:10.952Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 23.7,
                "spikePct": 9.97
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:28:10.953Z",
            "updatedAt": "2026-06-12T02:28:10.953Z"
        },
        {
            "_id": "6a2b6e423f1203aa160cdc04",
            "opportunityId": "opp-run-lrKfFJfa2p-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-lrKfFJfa2p",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 13.3pt above 7d avg (20.37%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:26:10.958Z",
            "expiresAt": "2026-06-13T02:26:10.957Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 20.37,
                "spikePct": 13.3
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:26:10.960Z",
            "updatedAt": "2026-06-12T02:26:10.960Z"
        },
        {
            "_id": "6a2b6e423f1203aa160cdc03",
            "opportunityId": "opp-run-lrKfFJfa2p-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-lrKfFJfa2p",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 14.3pt above 7d avg (58.01%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:26:10.957Z",
            "expiresAt": "2026-06-13T02:26:10.957Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 58.01,
                "spikePct": 14.3
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:26:10.960Z",
            "updatedAt": "2026-06-12T02:26:10.960Z"
        },
        {
            "_id": "6a2b6e063f1203aa160cdbfe",
            "opportunityId": "opp-run-rxRp4W2hV5-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-rxRp4W2hV5",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 17.88pt above 7d avg (54.43%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:25:10.840Z",
            "expiresAt": "2026-06-13T02:25:10.840Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 54.43,
                "spikePct": 17.88
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:25:10.841Z",
            "updatedAt": "2026-06-12T02:25:10.841Z"
        },
        {
            "_id": "6a2b6e063f1203aa160cdbff",
            "opportunityId": "opp-run-rxRp4W2hV5-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-rxRp4W2hV5",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 16.62pt above 7d avg (17.05%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:25:10.840Z",
            "expiresAt": "2026-06-13T02:25:10.840Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 17.05,
                "spikePct": 16.62
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:25:10.842Z",
            "updatedAt": "2026-06-12T02:25:10.842Z"
        },
        {
            "_id": "6a2b6e063f1203aa160cdc00",
            "opportunityId": "opp-run-rxRp4W2hV5-10137e20",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-rxRp4W2hV5",
            "title": "aerodrome-slipstream/Base APY spike: 78.07%",
            "detail": "WETH-USDC APY jumped 5.69pt above 7d avg (72.38%). TVL: $8.2M.",
            "asset": "WETH-USDC",
            "protocol": "aerodrome-slipstream",
            "chain": "Base",
            "score": 78,
            "acted": false,
            "detectedAt": "2026-06-12T02:25:10.840Z",
            "expiresAt": "2026-06-13T02:25:10.840Z",
            "metadata": {
                "pool": "10137e20-efbc-4e15-a733-17ecb52c48e8",
                "protocol": "aerodrome-slipstream",
                "chain": "Base",
                "symbol": "WETH-USDC",
                "apyPct": 78.07,
                "tvlUsd": 8235880,
                "apyBase": 31.12621,
                "apyReward": 46.94078,
                "avg7dApyPct": 72.38,
                "spikePct": 5.69
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:25:10.842Z",
            "updatedAt": "2026-06-12T02:25:10.842Z"
        },
        {
            "_id": "6a2b6e063f1203aa160cdc01",
            "opportunityId": "opp-run-rxRp4W2hV5-b6b23226",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-rxRp4W2hV5",
            "title": "fluid-dex/Ethereum APY spike: 13.19%",
            "detail": "USDE-USDT APY jumped 5.55pt above 7d avg (7.64%). TVL: $6.0M.",
            "asset": "USDE-USDT",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 78,
            "acted": false,
            "detectedAt": "2026-06-12T02:25:10.840Z",
            "expiresAt": "2026-06-13T02:25:10.840Z",
            "metadata": {
                "pool": "b6b23226-90d9-4cf5-93b8-057a5364705f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDE-USDT",
                "apyPct": 13.19,
                "tvlUsd": 5985013,
                "apyBase": 13.19386,
                "apyReward": null,
                "avg7dApyPct": 7.64,
                "spikePct": 5.55
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:25:10.842Z",
            "updatedAt": "2026-06-12T02:25:10.842Z"
        },
        {
            "_id": "6a2b6d923f1203aa160cdbf9",
            "opportunityId": "opp-run-hjQlR83-Jh-58990934",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-hjQlR83-Jh",
            "title": "pharaoh-v3/Avalanche APY spike: 72.31%",
            "detail": "USDT-USDC APY jumped 21.45pt above 7d avg (50.86%). TVL: $11.0M.",
            "asset": "USDT-USDC",
            "protocol": "pharaoh-v3",
            "chain": "Avalanche",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:23:14.235Z",
            "expiresAt": "2026-06-13T02:23:14.234Z",
            "metadata": {
                "pool": "58990934-9fb1-45f2-8882-d493c4627768",
                "protocol": "pharaoh-v3",
                "chain": "Avalanche",
                "symbol": "USDT-USDC",
                "apyPct": 72.31,
                "tvlUsd": 10989987,
                "apyBase": 0,
                "apyReward": 72.3128,
                "avg7dApyPct": 50.86,
                "spikePct": 21.45
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:23:14.236Z",
            "updatedAt": "2026-06-12T02:23:14.236Z"
        },
        {
            "_id": "6a2b6d923f1203aa160cdbfa",
            "opportunityId": "opp-run-hjQlR83-Jh-da292ed1",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-hjQlR83-Jh",
            "title": "fluid-dex/Ethereum APY spike: 33.67%",
            "detail": "USDC-ETH APY jumped 19.95pt above 7d avg (13.72%). TVL: $9.2M.",
            "asset": "USDC-ETH",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 100,
            "acted": false,
            "detectedAt": "2026-06-12T02:23:14.235Z",
            "expiresAt": "2026-06-13T02:23:14.234Z",
            "metadata": {
                "pool": "da292ed1-aff5-44e0-8e23-333a1c61ee7f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDC-ETH",
                "apyPct": 33.67,
                "tvlUsd": 9186953,
                "apyBase": 33.67359,
                "apyReward": null,
                "avg7dApyPct": 13.72,
                "spikePct": 19.95
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:23:14.236Z",
            "updatedAt": "2026-06-12T02:23:14.236Z"
        },
        {
            "_id": "6a2b6d923f1203aa160cdbfb",
            "opportunityId": "opp-run-hjQlR83-Jh-10137e20",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-hjQlR83-Jh",
            "title": "aerodrome-slipstream/Base APY spike: 78.07%",
            "detail": "WETH-USDC APY jumped 6.83pt above 7d avg (71.24%). TVL: $8.2M.",
            "asset": "WETH-USDC",
            "protocol": "aerodrome-slipstream",
            "chain": "Base",
            "score": 84,
            "acted": false,
            "detectedAt": "2026-06-12T02:23:14.235Z",
            "expiresAt": "2026-06-13T02:23:14.234Z",
            "metadata": {
                "pool": "10137e20-efbc-4e15-a733-17ecb52c48e8",
                "protocol": "aerodrome-slipstream",
                "chain": "Base",
                "symbol": "WETH-USDC",
                "apyPct": 78.07,
                "tvlUsd": 8235880,
                "apyBase": 31.12621,
                "apyReward": 46.94078,
                "avg7dApyPct": 71.24,
                "spikePct": 6.83
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:23:14.236Z",
            "updatedAt": "2026-06-12T02:23:14.236Z"
        },
        {
            "_id": "6a2b6d923f1203aa160cdbfc",
            "opportunityId": "opp-run-hjQlR83-Jh-b6b23226",
            "type": "yield_anomaly",
            "strategy": "yieldHunter",
            "runId": "run-hjQlR83-Jh",
            "title": "fluid-dex/Ethereum APY spike: 13.19%",
            "detail": "USDE-USDT APY jumped 6.66pt above 7d avg (6.53%). TVL: $6.0M.",
            "asset": "USDE-USDT",
            "protocol": "fluid-dex",
            "chain": "Ethereum",
            "score": 83,
            "acted": false,
            "detectedAt": "2026-06-12T02:23:14.235Z",
            "expiresAt": "2026-06-13T02:23:14.234Z",
            "metadata": {
                "pool": "b6b23226-90d9-4cf5-93b8-057a5364705f",
                "protocol": "fluid-dex",
                "chain": "Ethereum",
                "symbol": "USDE-USDT",
                "apyPct": 13.19,
                "tvlUsd": 5985013,
                "apyBase": 13.19386,
                "apyReward": null,
                "avg7dApyPct": 6.53,
                "spikePct": 6.66
            },
            "__v": 0,
            "createdAt": "2026-06-12T02:23:14.236Z",
            "updatedAt": "2026-06-12T02:23:14.236Z"
        }
    ],
    "count": 19
}



===========================================================

{{BASE_URL}}/api/positions?status=open

{
    "positions": [],
    "count": 0
}



========================================================
{{BASE_URL}}/api/paper-wallet

{
    "_id": "6a297888f6e057d746bfcae5",
    "walletId": "paper-default",
    "mode": "paper",
    "balances": [
        {
            "symbol": "USDC",
            "amount": 5000,
            "valueUsd": 5000,
            "avgCostUsd": 1,
            "updatedAt": "2026-06-10T14:45:28.231Z"
        }
    ],
    "totalValueUsd": 5000,
    "initialUsd": 5000,
    "realizedPnlUsd": 0,
    "unrealizedPnlUsd": 0,
    "createdAt": "2026-06-10T14:45:28.236Z",
    "updatedAt": "2026-06-10T14:45:28.236Z",
    "__v": 0
}


=============================================================

{{BASE_URL}}/api/chart/primitives/SOLUSDT

{
    "success": true,
    "data": {
        "meta": {
            "symbol": "SOLUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T04:24:21.153Z",
            "token_count_estimate": 1201
        },
        "indicators": {
            "rsi_14": 59.4,
            "macd": {
                "value": 0.1135,
                "signal": -0.287,
                "histogram": 0.4005,
                "cross": "none"
            },
            "stoch": {
                "k": 92.72,
                "d": 91.86,
                "state": "overbought"
            },
            "adx": 8.91,
            "ichimoku": {
                "tenkan_sen": 64.88,
                "kijun_sen": 65.255,
                "senkou_a": 65.0675,
                "senkou_b": 67.115,
                "chikou_span": 67.05,
                "price_vs_cloud": "inside",
                "tk_cross": "none",
                "cloud_color": "red",
                "chikou_clear": true
            },
            "vwap": {
                "value": 79.0062,
                "upper_band_1": 89.8672,
                "lower_band_1": 68.1451,
                "upper_band_2": 100.7283,
                "lower_band_2": 57.284,
                "price_vs_vwap": "below"
            },
            "obv_trend": "flat",
            "cmf": 0.1349,
            "mfi": 58.47,
            "cci": 119.07,
            "atr_14": 1.3557,
            "bb": {
                "upper": 67.7898,
                "mid": 65.4045,
                "lower": 63.0192,
                "squeeze": false,
                "percent_b": 0.8449
            },
            "williams_r": -7.28
        },
        "structure": {
            "trend_htf": "bearish",
            "trend_ltf": "bullish",
            "key_levels": [
                {
                    "price": 65.135,
                    "type": "support",
                    "strength": "moderate",
                    "source": "previous_low",
                    "touches": 2
                },
                {
                    "price": 63.714999999999996,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 4
                },
                {
                    "price": 62.64333333333334,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 3
                },
                {
                    "price": 61.32,
                    "type": "support",
                    "strength": "weak",
                    "source": "previous_low",
                    "touches": 1
                },
                {
                    "price": 60.13,
                    "type": "support",
                    "strength": "weak",
                    "source": "previous_low",
                    "touches": 1
                }
            ],
            "vpoc": 84.85249999999999,
            "vah": 97.6125,
            "val": 68.9025,
            "pivot_points": {
                "standard": {
                    "method": "standard",
                    "pp": 66.92,
                    "r1": 67.42,
                    "r2": 67.8,
                    "r3": 68.3,
                    "s1": 66.54,
                    "s2": 66.04,
                    "s3": 65.66000000000001
                },
                "camarilla": {
                    "method": "camarilla",
                    "pp": 66.92,
                    "r1": 67.993304,
                    "r2": 68.066608,
                    "r3": 68.14,
                    "s1": 66.08669600000002,
                    "s2": 66.01339200000001,
                    "s3": 65.94000000000001
                }
            },
            "psychological_levels": [
                77,
                78,
                79,
                80,
                81,
                82
            ]
        },
        "smart_money": {
            "order_blocks": [
                {
                    "price_high": 63.66,
                    "price_low": 62.34,
                    "type": "bullish",
                    "status": "unmitigated",
                    "timeframe": "4H"
                }
            ],
            "fvgs": [
                {
                    "high": 66.36,
                    "low": 65.93,
                    "timestamp": 1781193600000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 64.77,
                    "low": 63.66,
                    "timestamp": 1781136000000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 73.24,
                    "low": 73.18,
                    "timestamp": 1780502400000,
                    "filled": false,
                    "type": "bearish"
                }
            ],
            "bos": {
                "direction": "bullish",
                "level": 65.77,
                "timestamp": 1781193600000,
                "type": "BOS",
                "confirmed": true
            },
            "choch": null,
            "liquidity_sweeps": [
                {
                    "level": 63.54,
                    "swept": true,
                    "timestamp": 1781121600000,
                    "candles_ago": 8,
                    "type": "buy_side"
                },
                {
                    "level": 65.7,
                    "swept": true,
                    "timestamp": 1780992000000,
                    "candles_ago": 17,
                    "type": "sell_side"
                },
                {
                    "level": 65.7,
                    "swept": true,
                    "timestamp": 1781006400000,
                    "candles_ago": 16,
                    "type": "sell_side"
                }
            ]
        },
        "fibonacci": {
            "swing_high": 67.42,
            "swing_low": 62.34,
            "swing_high_ts": 1781193600000,
            "swing_low_ts": 1781121600000,
            "direction": "bearish_retracement",
            "levels": {
                "0.236": 63.538880000000006,
                "0.382": 64.28056000000001,
                "0.5": 64.88,
                "0.618": 65.47944,
                "0.786": 66.33288
            },
            "extensions": {
                "1.272": 60.95824,
                "1.618": 59.20056,
                "2.618": 54.120560000000005
            },
            "current_price_near": "1"
        },
        "wyckoff": {
            "phase": "B",
            "last_event": "SC",
            "spring_confirmed": false,
            "utad_risk": false,
            "range_high": 79.8,
            "range_low": 60.13,
            "cause_count": 60,
            "volume_analysis": "neutral",
            "summary": "Wyckoff Accumulation Phase B. Range building after SC. Watch for Spring near 60.13. Range: 60.13 - 79.80."
        },
        "elliott": {
            "wave_count": "unknown",
            "pivots": [
                97,
                93.43,
                98.41,
                89.82,
                93.68,
                83.5,
                88,
                81.5,
                87.5,
                83.7,
                86.52,
                80,
                83.01,
                80.35,
                83.42,
                79.11,
                81.65,
                72.73,
                75.13,
                72.69,
                75.71,
                66.8,
                71.8,
                67.37,
                70.64,
                63.87,
                66.8,
                63.78,
                66.06,
                62.64,
                64.86,
                60.13,
                63.6,
                61.32,
                66.11,
                63.67,
                67.92,
                64.98,
                68.17,
                65.29,
                67.47,
                63.54,
                65.7,
                62.95,
                65.77,
                62.34,
                67.42
            ],
            "pivot_timestamps": [
                1778428800000,
                1778443200000,
                1778529600000,
                1778716800000,
                1778774400000,
                1779048000000,
                1779379200000,
                1779508800000,
                1779566400000,
                1779652800000,
                1779710400000,
                1779940800000,
                1779984000000,
                1780056000000,
                1780185600000,
                1780329600000,
                1780344000000,
                1780430400000,
                1780444800000,
                1780459200000,
                1780473600000,
                1780531200000,
                1780545600000,
                1780560000000,
                1780574400000,
                1780632000000,
                1780646400000,
                1780660800000,
                1780675200000,
                1780689600000,
                1780704000000,
                1780718400000,
                1780732800000,
                1780747200000,
                1780819200000,
                1780833600000,
                1780862400000,
                1780891200000,
                1780948800000,
                1780963200000,
                1780977600000,
                1781020800000,
                1781035200000,
                1781078400000,
                1781092800000,
                1781121600000,
                1781193600000
            ],
            "confidence": 0,
            "rules_passed": [],
            "rules_failed": [
                "No valid wave pattern found in recent pivots"
            ]
        },
        "harmonics": null,
        "mtfa": {
            "1D": {
                "bias": "bearish",
                "structure": "bearish at support",
                "key_level": 66.8,
                "at_level": true,
                "regime": "trending_down"
            },
            "4H": {
                "bias": "neutral",
                "structure": "consolidating at resistance",
                "key_level": 67.23,
                "at_level": true,
                "regime": "ranging"
            },
            "1H": {
                "bias": "bullish",
                "structure": "bullish at resistance",
                "key_level": 67.23,
                "at_level": true,
                "regime": "trending_up"
            },
            "overall_bias": "neutral",
            "htf_overrides_ltf": true,
            "confluence_note": "HTF (1D) is bearish — overrides LTF (1H) bullish signal. 1/3 timeframes aligned neutral."
        }
    }
}


=======================================================================
{{BASE_URL}}/api/chart/analyze/BTCUSDT

{
    "success": true,
    "data": {
        "primitives_meta": {
            "symbol": "BTCUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T04:25:42.175Z",
            "token_count_estimate": 1123
        },
        "analysis": {
            "regime": "ranging",
            "bias": "short",
            "primary_framework": "SmartMoney",
            "setup_name": "Bearish OB + Unfilled FVG + HTF Resistance Rejection",
            "entry_zone": {
                "high": 63933.02,
                "low": 63239.43
            },
            "stop_loss": 64160.42,
            "take_profit_levels": [
                62205,
                61088.19,
                59315.455
            ],
            "risk_reward": 3.2,
            "confidence": 65,
            "invalidation": "Daily close above 64497.97 (strong resistance) invalidates bearish thesis.",
            "reasoning": "The 1D trend is bearish and overrides the LTF neutral bias. Price is consolidating at a strong resistance level (63933) with a bearish 4H order block (74092-73222) still unmitigated above. Multiple unfilled bearish FVGs (65251-64540, 66076-65860) act as supply zones. The HTF bearish bias, proximity to resistance, and unfilled supply blocks create a high-probability short entry zone. The 3.2:1 R:R meets the SmartMoney minimum.",
            "framework_scores": {
                "SmartMoney": 85,
                "Wyckoff": 30,
                "ElliottWave": 0,
                "Harmonic": 0
            },
            "confluence_score": 3,
            "confluence_factors": [
                "HTF (1D) bearish trend overrides LTF neutral",
                "Price at strong resistance (63933, 3 touches)",
                "Unmitigated bearish 4H order block above",
                "Unfilled bearish FVGs above price"
            ]
        },
        "risk": {
            "approved": true,
            "adjusted_confidence": 65,
            "adjusted_size_mult": 0.93,
            "warnings": [
                "Reduced size to 93% due to confidence 65"
            ]
        }
    }
}

==============================================================

{{BASE_URL}}/api/chart/primitives/BTCUSDT

{
    "success": true,
    "data": {
        "meta": {
            "symbol": "BTCUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T04:29:24.016Z",
            "token_count_estimate": 1124
        },
        "indicators": {
            "rsi_14": 60.98,
            "macd": {
                "value": 184.9243,
                "signal": -64.3463,
                "histogram": 249.2706,
                "cross": "none"
            },
            "stoch": {
                "k": 95.89,
                "d": 91.13,
                "state": "overbought"
            },
            "adx": 3.77,
            "ichimoku": {
                "tenkan_sen": 62518.63,
                "kijun_sen": 62477.5,
                "senkou_a": 62498.065,
                "senkou_b": 62752.045,
                "chikou_span": 63802.32,
                "price_vs_cloud": "above",
                "tk_cross": "none",
                "cloud_color": "red",
                "chikou_clear": true
            },
            "vwap": {
                "value": 70482.4109,
                "upper_band_1": 77756.4914,
                "lower_band_1": 63208.3304,
                "upper_band_2": 85030.5719,
                "lower_band_2": 55934.2499,
                "price_vs_vwap": "below"
            },
            "obv_trend": "rising",
            "cmf": 0.0893,
            "mfi": 57.6,
            "cci": 117.82,
            "atr_14": 873.06,
            "bb": {
                "upper": 64174.3306,
                "mid": 62496.684,
                "lower": 60819.0374,
                "squeeze": false,
                "percent_b": 0.8891
            },
            "williams_r": -4.11
        },
        "structure": {
            "trend_htf": "bearish",
            "trend_ltf": "consolidating",
            "key_levels": [
                {
                    "price": 62205,
                    "type": "support",
                    "strength": "weak",
                    "source": "previous_low",
                    "touches": 1
                },
                {
                    "price": 61088.19,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 3
                },
                {
                    "price": 59315.455,
                    "type": "support",
                    "strength": "moderate",
                    "source": "previous_low",
                    "touches": 2
                },
                {
                    "price": 63933.02,
                    "type": "resistance",
                    "strength": "weak",
                    "source": "previous_high",
                    "touches": 1
                },
                {
                    "price": 64497.97333333333,
                    "type": "resistance",
                    "strength": "strong",
                    "source": "previous_high",
                    "touches": 3
                }
            ],
            "vpoc": 77128.64270833334,
            "vah": 81992.89479166668,
            "val": 63508.736875,
            "pivot_points": {
                "standard": {
                    "method": "standard",
                    "pp": 63545.45333333334,
                    "r1": 63789.37666666668,
                    "r2": 64053.93333333334,
                    "r3": 64297.85666666668,
                    "s1": 63280.896666666675,
                    "s2": 63036.973333333335,
                    "s3": 62772.41666666667
                },
                "camarilla": {
                    "method": "camarilla",
                    "pp": 63545.45333333334,
                    "r1": 64075.656384,
                    "r2": 64118.012768,
                    "r3": 64160.420000000006,
                    "s1": 62973.983616,
                    "s2": 62931.627232,
                    "s3": 62889.219999999994
                }
            },
            "psychological_levels": [
                68000,
                69000,
                70000,
                71000,
                72000,
                73000
            ]
        },
        "smart_money": {
            "order_blocks": [
                {
                    "price_high": 74092,
                    "price_low": 73222,
                    "type": "bearish",
                    "status": "unmitigated",
                    "timeframe": "4H"
                }
            ],
            "fvgs": [
                {
                    "high": 63270,
                    "low": 63239.43,
                    "timestamp": 1781193600000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 65251,
                    "low": 64540.3,
                    "timestamp": 1780516800000,
                    "filled": false,
                    "type": "bearish"
                },
                {
                    "high": 66076,
                    "low": 65860,
                    "timestamp": 1780502400000,
                    "filled": false,
                    "type": "bearish"
                }
            ],
            "bos": {
                "direction": "bullish",
                "level": 62000,
                "timestamp": 1780862400000,
                "type": "BOS",
                "confirmed": true
            },
            "choch": null,
            "liquidity_sweeps": [
                {
                    "level": 62000,
                    "swept": true,
                    "timestamp": 1780992000000,
                    "candles_ago": 17,
                    "type": "sell_side"
                },
                {
                    "level": 62000,
                    "swept": true,
                    "timestamp": 1781092800000,
                    "candles_ago": 10,
                    "type": "sell_side"
                },
                {
                    "level": 62000,
                    "swept": true,
                    "timestamp": 1781107200000,
                    "candles_ago": 9,
                    "type": "sell_side"
                }
            ]
        },
        "fibonacci": {
            "swing_high": 64234.68,
            "swing_low": 59500,
            "swing_high_ts": 1780862400000,
            "swing_low_ts": 1780718400000,
            "direction": "bearish_retracement",
            "levels": {
                "0.236": 60617.38448,
                "0.382": 61308.64776,
                "0.5": 61867.34,
                "0.618": 62426.03224,
                "0.786": 63221.45848
            },
            "extensions": {
                "1.272": 58212.16704,
                "1.618": 56573.96776,
                "2.618": 51839.28776
            },
            "current_price_near": "1"
        },
        "wyckoff": {
            "phase": "B",
            "last_event": "SC",
            "spring_confirmed": false,
            "utad_risk": false,
            "range_high": 70172,
            "range_low": 59130.91,
            "cause_count": 60,
            "volume_analysis": "neutral",
            "summary": "Wyckoff Accumulation Phase B. Range building after SC. Watch for Spring near 59130.91. Range: 59130.91 - 70172.00."
        },
        "elliott": {
            "wave_count": "unknown",
            "pivots": [
                74289.6,
                78080,
                65426.34,
                67516,
                61383.56,
                64764.32,
                62205,
                64494.92,
                61126.01,
                63259.9,
                59130.91,
                62000,
                59500,
                64234.68,
                60755,
                63933.02
            ],
            "pivot_timestamps": [
                1779508800000,
                1779796800000,
                1780444800000,
                1780459200000,
                1780531200000,
                1780545600000,
                1780560000000,
                1780574400000,
                1780632000000,
                1780646400000,
                1780675200000,
                1780689600000,
                1780718400000,
                1780862400000,
                1781078400000,
                1781193600000
            ],
            "confidence": 0,
            "rules_passed": [],
            "rules_failed": [
                "No valid wave pattern found in recent pivots"
            ]
        },
        "harmonics": null,
        "mtfa": {
            "1D": {
                "bias": "bearish",
                "structure": "bearish at resistance",
                "key_level": 64048.56666666666,
                "at_level": true,
                "regime": "trending_down"
            },
            "4H": {
                "bias": "neutral",
                "structure": "consolidating at resistance",
                "key_level": 63933.02,
                "at_level": true,
                "regime": "ranging"
            },
            "1H": {
                "bias": "neutral",
                "structure": "consolidating at resistance",
                "key_level": 63933.02,
                "at_level": true,
                "regime": "ranging"
            },
            "overall_bias": "conflicted",
            "htf_overrides_ltf": true,
            "confluence_note": "HTF (1D) is bearish — overrides LTF (1H) neutral signal. Mixed signals across timeframes — reduce size or wait for alignment."
        }
    }
}



==============================================================


{{BASE_URL}}/api/chart/primitives/SOLUSDT

{
    "success": true,
    "data": {
        "meta": {
            "symbol": "SOLUSDT",
            "timeframes_analyzed": [
                "1h",
                "4h",
                "1d"
            ],
            "generated_at": "2026-06-12T04:30:34.476Z",
            "token_count_estimate": 1209
        },
        "indicators": {
            "rsi_14": 59.63,
            "macd": {
                "value": 0.1183,
                "signal": -0.2861,
                "histogram": 0.4044,
                "cross": "none"
            },
            "stoch": {
                "k": 93.9,
                "d": 92.26,
                "state": "overbought"
            },
            "adx": 8.91,
            "ichimoku": {
                "tenkan_sen": 64.88,
                "kijun_sen": 65.255,
                "senkou_a": 65.0675,
                "senkou_b": 67.115,
                "chikou_span": 67.11,
                "price_vs_cloud": "inside",
                "tk_cross": "none",
                "cloud_color": "red",
                "chikou_clear": true
            },
            "vwap": {
                "value": 79.005,
                "upper_band_1": 89.8662,
                "lower_band_1": 68.1439,
                "upper_band_2": 100.7274,
                "lower_band_2": 57.2827,
                "price_vs_vwap": "below"
            },
            "obv_trend": "flat",
            "cmf": 0.1361,
            "mfi": 58.53,
            "cci": 120.89,
            "atr_14": 1.3579,
            "bb": {
                "upper": 67.8012,
                "mid": 65.4075,
                "lower": 63.0138,
                "squeeze": false,
                "percent_b": 0.8556
            },
            "williams_r": -6.1
        },
        "structure": {
            "trend_htf": "bearish",
            "trend_ltf": "bullish",
            "key_levels": [
                {
                    "price": 67.08500000000001,
                    "type": "support",
                    "strength": "moderate",
                    "source": "previous_low",
                    "touches": 2
                },
                {
                    "price": 65.135,
                    "type": "support",
                    "strength": "moderate",
                    "source": "previous_low",
                    "touches": 2
                },
                {
                    "price": 63.714999999999996,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 4
                },
                {
                    "price": 62.64333333333334,
                    "type": "support",
                    "strength": "strong",
                    "source": "previous_low",
                    "touches": 3
                },
                {
                    "price": 61.32,
                    "type": "support",
                    "strength": "weak",
                    "source": "previous_low",
                    "touches": 1
                }
            ],
            "vpoc": 84.85249999999999,
            "vah": 97.6125,
            "val": 68.9025,
            "pivot_points": {
                "standard": {
                    "method": "standard",
                    "pp": 66.92,
                    "r1": 67.42,
                    "r2": 67.8,
                    "r3": 68.3,
                    "s1": 66.54,
                    "s2": 66.04,
                    "s3": 65.66000000000001
                },
                "camarilla": {
                    "method": "camarilla",
                    "pp": 66.92,
                    "r1": 67.993304,
                    "r2": 68.066608,
                    "r3": 68.14,
                    "s1": 66.08669600000002,
                    "s2": 66.01339200000001,
                    "s3": 65.94000000000001
                }
            },
            "psychological_levels": [
                77,
                78,
                79,
                80,
                81,
                82
            ]
        },
        "smart_money": {
            "order_blocks": [
                {
                    "price_high": 63.66,
                    "price_low": 62.34,
                    "type": "bullish",
                    "status": "unmitigated",
                    "timeframe": "4H"
                }
            ],
            "fvgs": [
                {
                    "high": 66.36,
                    "low": 65.93,
                    "timestamp": 1781193600000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 64.77,
                    "low": 63.66,
                    "timestamp": 1781136000000,
                    "filled": false,
                    "type": "bullish"
                },
                {
                    "high": 73.24,
                    "low": 73.18,
                    "timestamp": 1780502400000,
                    "filled": false,
                    "type": "bearish"
                }
            ],
            "bos": {
                "direction": "bullish",
                "level": 65.77,
                "timestamp": 1781193600000,
                "type": "BOS",
                "confirmed": true
            },
            "choch": null,
            "liquidity_sweeps": [
                {
                    "level": 63.54,
                    "swept": true,
                    "timestamp": 1781121600000,
                    "candles_ago": 8,
                    "type": "buy_side"
                },
                {
                    "level": 65.7,
                    "swept": true,
                    "timestamp": 1780992000000,
                    "candles_ago": 17,
                    "type": "sell_side"
                },
                {
                    "level": 65.7,
                    "swept": true,
                    "timestamp": 1781006400000,
                    "candles_ago": 16,
                    "type": "sell_side"
                }
            ]
        },
        "fibonacci": {
            "swing_high": 67.42,
            "swing_low": 62.34,
            "swing_high_ts": 1781193600000,
            "swing_low_ts": 1781121600000,
            "direction": "bearish_retracement",
            "levels": {
                "0.236": 63.538880000000006,
                "0.382": 64.28056000000001,
                "0.5": 64.88,
                "0.618": 65.47944,
                "0.786": 66.33288
            },
            "extensions": {
                "1.272": 60.95824,
                "1.618": 59.20056,
                "2.618": 54.120560000000005
            },
            "current_price_near": "1"
        },
        "wyckoff": {
            "phase": "B",
            "last_event": "SC",
            "spring_confirmed": false,
            "utad_risk": false,
            "range_high": 79.8,
            "range_low": 60.13,
            "cause_count": 60,
            "volume_analysis": "neutral",
            "summary": "Wyckoff Accumulation Phase B. Range building after SC. Watch for Spring near 60.13. Range: 60.13 - 79.80."
        },
        "elliott": {
            "wave_count": "unknown",
            "pivots": [
                97,
                93.43,
                98.41,
                89.82,
                93.68,
                83.5,
                88,
                81.5,
                87.5,
                83.7,
                86.52,
                80,
                83.01,
                80.35,
                83.42,
                79.11,
                81.65,
                72.73,
                75.13,
                72.69,
                75.71,
                66.8,
                71.8,
                67.37,
                70.64,
                63.87,
                66.8,
                63.78,
                66.06,
                62.64,
                64.86,
                60.13,
                63.6,
                61.32,
                66.11,
                63.67,
                67.92,
                64.98,
                68.17,
                65.29,
                67.47,
                63.54,
                65.7,
                62.95,
                65.77,
                62.34,
                67.42
            ],
            "pivot_timestamps": [
                1778428800000,
                1778443200000,
                1778529600000,
                1778716800000,
                1778774400000,
                1779048000000,
                1779379200000,
                1779508800000,
                1779566400000,
                1779652800000,
                1779710400000,
                1779940800000,
                1779984000000,
                1780056000000,
                1780185600000,
                1780329600000,
                1780344000000,
                1780430400000,
                1780444800000,
                1780459200000,
                1780473600000,
                1780531200000,
                1780545600000,
                1780560000000,
                1780574400000,
                1780632000000,
                1780646400000,
                1780660800000,
                1780675200000,
                1780689600000,
                1780704000000,
                1780718400000,
                1780732800000,
                1780747200000,
                1780819200000,
                1780833600000,
                1780862400000,
                1780891200000,
                1780948800000,
                1780963200000,
                1780977600000,
                1781020800000,
                1781035200000,
                1781078400000,
                1781092800000,
                1781121600000,
                1781193600000
            ],
            "confidence": 0,
            "rules_passed": [],
            "rules_failed": [
                "No valid wave pattern found in recent pivots"
            ]
        },
        "harmonics": null,
        "mtfa": {
            "1D": {
                "bias": "bearish",
                "structure": "bearish at support",
                "key_level": 66.8,
                "at_level": true,
                "regime": "trending_down"
            },
            "4H": {
                "bias": "neutral",
                "structure": "consolidating at support",
                "key_level": 67.08500000000001,
                "at_level": true,
                "regime": "ranging"
            },
            "1H": {
                "bias": "bullish",
                "structure": "bullish at support",
                "key_level": 67.08500000000001,
                "at_level": true,
                "regime": "trending_up"
            },
            "overall_bias": "neutral",
            "htf_overrides_ltf": true,
            "confluence_note": "HTF (1D) is bearish — overrides LTF (1H) bullish signal. 1/3 timeframes aligned neutral."
        }
    }
}


{{BASE_URL}}/api/agent-runs?limit=1&status=completed



{
    "runs": [
        {
            "_id": "6a2b82a73f1203aa160cdc4b",
            "runId": "run-NT2LiM-e59",
            "strategy": "yieldHunter",
            "mode": "paper",
            "startedAt": "2026-06-12T03:53:11.139Z",
            "status": "completed",
            "createdAt": "2026-06-12T03:53:11.143Z",
            "updatedAt": "2026-06-12T03:54:15.976Z",
            "__v": 0,
            "completedAt": "2026-06-12T03:54:15.976Z",
            "decision": {
                "intent": {
                    "type": "no_action",
                    "rationale": "No anomalies detected in yield pools this cycle (APY spikes vs 7d avg = none). Market structure is bearish/conflicted across BTC, ETH, and SOL — not ideal for volatile LP pairs where IL could erode yield. The safest high-APY option (USDT-USDC on Avalanche at 59.42% APY, $11M TVL) requires a deposit action not available via swap tools. Holding $5,000 USDC is already the optimal position for yield hunting — no swap needed. Waiting for a yield anomaly or clearer market direction is the prudent call."
                },
                "confidence": 90,
                "reasoning": "No anomalies detected in yield pools this cycle (APY spikes vs 7d avg = none). Market structure is bearish/conflicted across BTC, ETH, and SOL — not ideal for volatile LP pairs where IL could erode yield. The safest high-APY option (USDT-USDC on Avalanche at 59.42% APY, $11M TVL) requires a deposit action not available via swap tools. Holding $5,000 USDC is already the optimal position for yield hunting — no swap needed. Waiting for a yield anomaly or clearer market direction is the prudent call.",
                "toolCallTrace": [
                    "get_wallet_state",
                    "get_price",
                    "get_token_volume",
                    "get_yields",
                    "get_news_sentiment",
                    "get_news_sentiment",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_full_htf_context",
                    "get_yields",
                    "no_action"
                ]
            },
            "executionResult": {
                "status": "filled",
                "simulatedPnlUsd": 0,
                "executedAt": "2026-06-12T03:54:15.975Z"
            }
        }
    ],
    "total": 1
}



===================================================================


{{BASE_URL}}/api/agent-runs/:runId


{
    "_id": "6a2b82a73f1203aa160cdc4b",
    "runId": "run-NT2LiM-e59",
    "strategy": "yieldHunter",
    "mode": "paper",
    "startedAt": "2026-06-12T03:53:11.139Z",
    "status": "completed",
    "contextSnapshot": "=== AGENT CONTEXT | 2026-06-12T03:53:11.754Z ===\nStrategy: yieldHunter\n\nWALLET (paper): USDC: $5000.00 | Total: $5000.00 | Today PnL: +$0.00 | Open positions: 0\n\n=== YIELD HUNTER — 2026-06-12T03:53:11.753Z ===\nScanned 334 USDC/stablecoin pools (TVL ≥ $5M)\n\nTOP 10 POOLS BY APY:\n  nest-cl/Hyperliquid L1 (WHYPE-USDC): 160.02% APY, TVL $7.6M\n  aerodrome-slipstream/Base (USDC-CBBTC): 110.53% APY, TVL $9.1M\n  gmtrade/Solana (XAU-USDC): 84.22% APY, TVL $6.3M\n  uniswap-v3/Base (WETH-USDC): 83.65% APY, TVL $97.8M\n  raydium-amm/Solana (WSOL-USDC): 78.36% APY, TVL $7.9M\n  minswap-dex/Cardano (NIGHT-USDCX): 76.59% APY, TVL $5.8M\n  uniswap-v4/Arbitrum (DORY-USDC): 76.22% APY, TVL $11.6M\n  aerodrome-slipstream/Base (WETH-USDC): 68.67% APY, TVL $8.4M\n  pharaoh-v3/Avalanche (USDT-USDC): 59.42% APY, TVL $11.0M\n  orca-dex/Solana (SOL-USDC): 52.73% APY, TVL $23.0M\n\nANOMALIES (APY spike > 5pt vs 7d avg):\n  None detected this cycle.",
    "createdAt": "2026-06-12T03:53:11.143Z",
    "updatedAt": "2026-06-12T03:54:15.976Z",
    "__v": 0,
    "completedAt": "2026-06-12T03:54:15.976Z",
    "decision": {
        "intent": {
            "type": "no_action",
            "rationale": "No anomalies detected in yield pools this cycle (APY spikes vs 7d avg = none). Market structure is bearish/conflicted across BTC, ETH, and SOL — not ideal for volatile LP pairs where IL could erode yield. The safest high-APY option (USDT-USDC on Avalanche at 59.42% APY, $11M TVL) requires a deposit action not available via swap tools. Holding $5,000 USDC is already the optimal position for yield hunting — no swap needed. Waiting for a yield anomaly or clearer market direction is the prudent call."
        },
        "confidence": 90,
        "reasoning": "No anomalies detected in yield pools this cycle (APY spikes vs 7d avg = none). Market structure is bearish/conflicted across BTC, ETH, and SOL — not ideal for volatile LP pairs where IL could erode yield. The safest high-APY option (USDT-USDC on Avalanche at 59.42% APY, $11M TVL) requires a deposit action not available via swap tools. Holding $5,000 USDC is already the optimal position for yield hunting — no swap needed. Waiting for a yield anomaly or clearer market direction is the prudent call.",
        "toolCallTrace": [
            "get_wallet_state",
            "get_price",
            "get_token_volume",
            "get_yields",
            "get_news_sentiment",
            "get_news_sentiment",
            "get_full_htf_context",
            "get_full_htf_context",
            "get_full_htf_context",
            "get_yields",
            "no_action"
        ]
    },
    "executionResult": {
        "status": "filled",
        "simulatedPnlUsd": 0,
        "executedAt": "2026-06-12T03:54:15.975Z"
    }
}

==============================================================


{{BASE_URL}}/api/agent-runs/trigger1

{
    "triggered": true,
    "waited": false
}

=======================================================================


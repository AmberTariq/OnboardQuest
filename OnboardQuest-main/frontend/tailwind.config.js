/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // ── Retro 8-bit palette ──────────────────────────────────────────────
      colors: {
        // Background layers
        "arcade-sky":    "#d6e8f5", // soft powder-blue world background
        "arcade-blue":   "#1a6fbf", // classic arcade cabinet blue (title bars, borders)
        "arcade-navy":   "#0d3d6b", // deep navy for pressed states / shadows
        "arcade-dusk":   "#2d5f8a", // mid-tone blue for panel fills

        // Surface / window chrome
        "pixel-cream":   "#f5f0e8", // warm window interior background
        "pixel-parchment":"#e8dfc8",// slightly deeper cream for alternating rows
        "pixel-linen":   "#faf7f2", // near-white for card surfaces

        // Accents
        "pixel-mint":    "#4ecb8c", // vibrant mint green (success, HP bars)
        "pixel-mint-dk": "#2fa86c", // darker mint for hover states
        "pixel-yellow":  "#f5d000", // pixel yellow (coins, stars, XP)
        "pixel-amber":   "#e8a800", // amber for pressed yellow
        "pixel-red":     "#e83c3c", // alert / danger
        "pixel-pink":    "#f48fb1", // hearts, friendly accents

        // Text
        "pixel-ink":     "#1a1a2e", // near-black text (warm dark)
        "pixel-muted":   "#5a6a82", // secondary text
        "pixel-caption": "#8899aa", // placeholder / disabled text
      },

      // ── Typography ────────────────────────────────────────────────────────
      fontFamily: {
        pixel: ['"Press Start 2P"', "monospace"],
        ui:    ['"VT323"', "monospace"],
        mono:  ['"Courier Prime"', '"Courier New"', "monospace"],
      },
      fontSize: {
        "2xs": ["0.6rem",  { lineHeight: "1rem" }],
        xs:    ["0.75rem", { lineHeight: "1.25rem" }],
      },

      // ── Spacing tokens ────────────────────────────────────────────────────
      spacing: {
        px2: "2px",
        px4: "4px",
      },

      // ── Border radii — keep it sharp / blocky ─────────────────────────────
      borderRadius: {
        none:   "0px",
        px:     "1px",
        sm:     "2px",
        DEFAULT:"2px",
        md:     "4px",
        lg:     "4px",
        xl:     "4px",
        full:   "2px",   // even "full" stays blocky
      },

      // ── Pixel-perfect box shadows ─────────────────────────────────────────
      boxShadow: {
        // Classic inset-raised button look (no blur)
        "pixel-raised":
          "inset -2px -2px 0 0 var(--tw-shadow-color, #0d3d6b), inset 2px 2px 0 0 #a8d4f5",
        // Window drop shadow (blocky offset)
        "pixel-window":
          "4px 4px 0 0 #0d3d6b",
        // Flat pressed state
        "pixel-pressed":
          "inset 2px 2px 0 0 #0d3d6b, inset -2px -2px 0 0 #a8d4f5",
        // XP / badge glow (minimal, pixel-safe)
        "pixel-glow-yellow":
          "0 0 0 2px #f5d000, 0 0 0 4px #e8a800",
        "pixel-glow-mint":
          "0 0 0 2px #4ecb8c, 0 0 0 4px #2fa86c",
        none: "none",
      },

      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0" },
        },
        "march-right": {
          "0%":   { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "16px 0" },
        },
        "float-up": {
          "0%":   { transform: "translateY(0)" },
          "50%":  { transform: "translateY(-4px)" },
          "100%": { transform: "translateY(0)" },
        },
        "pixel-pulse": {
          "0%, 100%": { transform: "scale(1)" },
          "50%":      { transform: "scale(1.04)" },
        },
      },
      animation: {
        blink:        "blink 1s step-start infinite",
        "float-up":   "float-up 2s ease-in-out infinite",
        "pixel-pulse":"pixel-pulse 1.5s ease-in-out infinite",
      },

      // ── Background patterns ───────────────────────────────────────────────
      backgroundImage: {
        // Tiny dot-grid for world map / quest board backgrounds
        "pixel-dots":
          "radial-gradient(circle, #1a6fbf22 1px, transparent 1px)",
        // Checkerboard for loading screens
        "pixel-checker":
          "repeating-conic-gradient(#d6e8f5 0% 25%, #f5f0e8 0% 50%)",
      },
      backgroundSize: {
        "pixel-dots":    "16px 16px",
        "pixel-checker": "16px 16px",
      },
    },
  },
  plugins: [],
};

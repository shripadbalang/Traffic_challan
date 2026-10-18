# Traffic E-Challan Design System (`MASTER.md`)

> **Generated via UI/UX Pro Max Skill Workflow + UUPM Reference**
> - **Domain**: Government / Public Service Traffic Enforcement & Enterprise SaaS Analytics
> - **Color Mode**: **Light Mode Only** (High-trust Civic Authority, Accessibility-First)
> - **Localization**: Multilingual Support (`en` English, `mr` Marathi / मराठी, `hi` Hindi / हिन्दी) for the Vehicle Owner Portal

---

## 1. Design Philosophy & Tooling Sources

1. **UI/UX Pro Max Skill (`nextlevelbuilder/ui-ux-pro-max-skill`)**:
   - **Matched Reasoning Rules**:
     - `Government/Public Service` (`ui-reasoning.csv` Row 13): High-contrast Light Mode, WCAG AAA target legibility, keyboard navigation rings, clear step indicators, predictable form patterns, zero decorative clutter.
     - `SaaS (General)` & `B2B Enterprise` (Rows 1 & 9): Clean structured cards, subtle borders (`1px solid #E2E8F0`), soft elevation shadows, clear visual hierarchy.
     - `Analytics & Enforcement Dashboard` (Row 7): Scannable KPI summary cards, tabular numerals (`font-mono`), semantic status badges (`#16856B` Paid, `#D97706` Pending, `#DC2626` Error/Violation).
   - **Antigravity Skill Installation Status**:
     - Local CLI installation command: `npm install -g ui-ux-pro-max-cli && uipro init --ai antigravity` (installs `.agents/skills/ui-ux-pro-max/`).
     - All design tokens, typography pairings, and component anti-patterns in this `MASTER.md` follow the UI/UX Pro Max `MASTER.md` specification format.
2. **UUPM (`https://uupm.cc/`)**:
   - Applied enterprise dashboard layout discipline: balanced whitespace (`#F7F9FC` canvas), crisp `#FFFFFF` surface cards, restrained primary civic blue (`#174EA6`), clear data tables, and compact action toolbars.

---

## 2. Color Tokens (Strictly Light Mode)

| Token Purpose | CSS Variable | Hex Value | Tailwind Utility / Usage |
| :--- | :--- | :--- | :--- |
| **Page Background** | `--bg-page` | `#F7F9FC` | `bg-[#F7F9FC]` — Main application canvas |
| **Card Background** | `--bg-card` | `#FFFFFF` | `bg-white` — Elevated cards, tables, modals, header |
| **Primary Blue** | `--primary` | `#174EA6` | `bg-[#174EA6]`, `text-[#174EA6]` — Primary CTAs, active tabs, brand accents |
| **Primary Hover** | `--primary-hover` | `#123B80` | `hover:bg-[#123B80]` — Hover state for primary interactive elements |
| **Main Text** | `--text-main` | `#172033` | `text-[#172033]` — Headings, primary body text, values |
| **Secondary Text** | `--text-secondary` | `#64748B` | `text-[#64748B]` — Labels, captions, helper text, metadata |
| **Border** | `--border-color` | `#E2E8F0` | `border-[#E2E8F0]` — Card outlines, dividers, input borders |
| **Success (Paid / Verified)** | `--success` | `#16856B` | `text-[#16856B]`, `bg-[#ECFDF5]`, `border-[#A7F3D0]` |
| **Pending / Warning** | `--pending` | `#D97706` | `text-[#D97706]`, `bg-[#FFFBEB]`, `border-[#FDE68A]` |
| **Error / Violation** | `--error` | `#DC2626` | `text-[#DC2626]`, `bg-[#FEF2F2]`, `border-[#FECACA]` |

---

## 3. Typography & Multilingual Devanagari Support

- **Primary Latin UI Font**: `'Inter'`, `'Plus Jakarta Sans'`, system sans-serif.
- **Devanagari UI Font (Marathi & Hindi)**: `'Noto Sans Devanagari'` loaded from Google Fonts (`400, 500, 600, 700`).
- **Monospace Data Font**: `'JetBrains Mono'` for Vehicle Registration Numbers (`MH12AB1234`), Challan IDs (`#104`), Transaction IDs, and timestamps.
- **Multilingual Layout Rules**:
  - Line-height is set to `1.6` (`leading-relaxed`) on body and interactive labels so Devanagari matras (upper/lower vowel marks) never clip.
  - Buttons and badges use `min-h-[38px]` / flexible horizontal padding (`px-4 py-2`) without fixed narrow widths so longer Marathi (`आता पैसे भरा`) and Hindi (`भुगतान किया गया`) phrases wrap or expand cleanly without layout overflow.
  - Identifiers (Vehicle numbers, Challan IDs, Transaction references, API codes) are never translated.

---

## 4. Component Guidelines & Anti-Patterns

- **Cards**: `bg-white border border-[#E2E8F0] rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)]`.
- **Inputs & Selects**: `bg-white border border-[#CBD5E1] text-[#172033] placeholder-[#64748B] rounded-lg focus:border-[#174EA6] focus:ring-2 focus:ring-[#174EA6]/20`.
- **Buttons**:
  - Primary: `bg-[#174EA6] hover:bg-[#123B80] text-white font-semibold rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#174EA6] focus-visible:ring-offset-2`
  - Secondary: `bg-white hover:bg-[#F1F5F9] text-[#172033] border border-[#E2E8F0] font-semibold rounded-lg transition-colors`
  - Success (`Pay Now` / Verified): `bg-[#16856B] hover:bg-[#116B55] text-white font-semibold rounded-lg shadow-sm`
  - Danger: `bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold rounded-lg shadow-sm`
- **Strict Anti-Patterns**:
  - No dark mode backgrounds (`#0A0F1D`, `#111827`) or neon/cyberpunk glows.
  - No heavy glassmorphism (`backdrop-blur` over dark gradients).
  - Minimum 4.5:1 contrast ratio on all text and interactive controls.

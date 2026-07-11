# Chunks Design System & Frontend Guidelines (DESIGN.md)

This document outlines the visual design system, typography, components, and layout styling rules for building interfaces that align perfectly with the **Chunks** aesthetic. Use this specification to style new features or replicate the exact user experience in companion projects.

---

## 1. Visual Vibe & Aesthetic Philosophy

The Chunks interface pairs **Swiss Modernism** with **High-Fidelity Telemetric Utility**. It is professional, content-first, tactile, and highly legible.

* **Craftsmanship over Clutter**: Rely on generous negative space, precise borders, and balanced margins. No redundant gradients or heavy colored cards.
* **Semantic Accents**: Use colors strictly for functional status indicators (Grades, Achievements, Connection states) while keeping the overall canvas crisp and neutral.
* **Architectural Honesty**: Use clear, literal, human-friendly labels. Avoid tech-jargon decoration. Show data cleanly without simulating synthetic terminal noise.

---

## 2. Typography Strategy

We pair three distinct font families to establish structural rhythm and visual contrast:

1. **Primary UI (`font-sans` - Inter)**: Used for body text, descriptive labels, dense data grids, form fields, and menus. It is highly optimized for legibility at small sizes.
2. **Display Headings (`font-display` - Space Grotesk)**: Used for tab headings, primary section titles, hero card statistics, and call-to-action buttons. Features tight spacing and sharp letterforms.
3. **Data / Telemetry (`font-mono` - JetBrains Mono or Fira Code)**: Used for coefficients, score values, timestamps, round counters, ratios, metrics, and metadata.

### Tailwind v4 Configuration Setup
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Space Grotesk", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}
```

---

## 3. Color System & Token Mapping

The canvas is anchored in cool slate grays with a signature **Deep Indigo** highlight for active states and selection indicators.

### 3.1 Base Neutrals
* **App Canvas Background**: `bg-slate-50` (`#f8fafc`)
* **White Card Panels**: `bg-white` (`#ffffff`)
* **Subtle Borders**: `border-slate-200` (`#e2e8f0`)
* **Dividers**: `divide-slate-100` (`#f1f5f9`)

### 3.2 Typography & Text Tones
* **Primary Headers**: `text-slate-900` (`#0f172a`)
* **Body / Active Labels**: `text-slate-700` (`#334155`)
* **Subtext / Helper Text**: `text-slate-400` (`#94a3b8`) or `text-slate-500`

### 3.3 Semantic Grade Mapping
Grade colors denote speech performance, scoring results, and response qualities:

| Grade | Tailwind Accent Classes | Color Value | Description / Context |
| :--- | :--- | :--- | :--- |
| **Purple** | `bg-purple-50 text-purple-700 border-purple-100` | `#701a75` | Brilliant / Exceptional Vocalization |
| **Green** | `bg-green-50 text-green-700 border-green-100` | `#15803d` | Flawless / Passing Score |
| **Yellow** | `bg-yellow-50 text-yellow-700 border-yellow-100` | `#a16207` | Needs Work / Hesitations Detected |
| **Red** | `bg-red-50 text-red-700 border-red-100` | `#b91c1c` | Incomplete / Unreadable / Critical |

---

## 4. Design Layout & Structural Sizing

All layouts respect a responsive desktop-first multi-column layout structure:

* **Container Caps**: All screens are enclosed in a max-width container to prevent horizontal stretching on wide screens:
  ```html
  <div className="max-w-7xl mx-auto px-6 py-8">
  ```
* **Card Shadows**: Use soft, light, custom shadows instead of heavy default ones:
  ```css
  shadow-3xs /* Subtle, elegant border shadow */
  ```
* **Touch Targets**: Standard interactive buttons and clickable elements must keep a minimum tap height of **44px** (or `py-2 px-4`) to ensure accessibility across desktop and tablet runtimes.

---

## 5. UI Component Recipes

Recreate the high-fidelity Chunks component suite using these clean Tailwind CSS templates:

### 5.1 The "Perfect" Content Card
An elegant, bordered panel container suitable for statistics, simulator rounds, or data listings.
```html
<div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-3xs hover:shadow-2xs transition-all duration-200">
  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
    <h3 className="font-display font-bold text-sm text-slate-800">Card Header Title</h3>
    <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">12.5 Ω</span>
  </div>
  <div className="py-4 text-xs text-slate-600 leading-relaxed">
    Interactive slot or list details go here...
  </div>
</div>
```

### 5.2 Primary Action Buttons
Interactive selectors featuring responsive scale scaling and custom active indicators.
```html
<button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-display font-semibold text-xs rounded-xl transition-all active:scale-97 cursor-pointer shadow-sm">
  <Play className="w-4 h-4" />
  <span>Bắt đầu Chunks</span>
</button>
```

### 5.3 Integrated Inline Filter Bar
A compact, highly professional filter section placed inside a panel to avoid unnecessary visual levels.
```html
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
  <div className="flex flex-wrap items-center gap-4">
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold text-slate-500">Sắp xếp theo:</span>
      <select className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:border-red-500 cursor-pointer shadow-3xs">
        <option>Điểm CPD Cao Nhất</option>
        <option>Tích Cực Nhất</option>
      </select>
    </div>
  </div>
</div>
```

### 5.4 Metric Badge Pill
Standard metadata indicator containing values like score outputs, formulas, and metric measurements.
```html
<span className="font-mono text-xs font-bold text-slate-950 bg-slate-100 border border-slate-200/60 px-2 py-1 rounded-lg flex items-center gap-1.5">
  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
  8.4 A
</span>
```

---

## 6. Motion & Interactive Transitions

Micro-interactions are controlled via subtle layout entries. Use Framer Motion (`motion/react`) for seamless component tabs switching:

```typescript
import { motion } from "motion/react";

// Standard Tab Entrance Animation
<motion.div
  initial={{ opacity: 0, y: 6 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -6 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
  className="space-y-6"
>
  {/* Tab Content */}
</motion.div>
```

---

## 7. Anti-Pattern Checklist for New Projects

Avoid these common visual errors to maintain design alignment:

- [ ] **No Raw Primary Gradients**: Avoid default vibrant indigo-to-purple backgrounds or buttons unless they are soft, dark overlays.
- [ ] **No Inconsistent Borders**: Do not mix rounded corners; always stick to `rounded-2xl` for main cards and `rounded-xl` / `rounded-lg` for inline selectors and pills.
- [ ] **No Loose Typography**: Never use decorative italic serifs or playful fonts. Only use **Inter**, **Space Grotesk**, and **JetBrains Mono**.
- [ ] **No Fake Logs**: Do not inject mock terminal screens or simulation metadata strings purely for aesthetic decoration. Use real data layouts.

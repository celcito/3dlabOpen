---
name: 3dlabOpen Workbench
description: Technical 3D printing preparation toolkit with warm tonal surfaces and precise controls
colors:
  primary: "#632CE5"
  primary-container: "#7C4DFF"
  primary-fixed: "#E8DEFF"
  primary-fixed-dim: "#CDBDFF"
  secondary: "#5F5E5E"
  secondary-container: "#E2DFDE"
  tertiary: "#904000"
  tertiary-container: "#FFDBC7"
  amber: "#F59E0B"
  error: "#DC2626"
  background: "#F9FAF4"
  surface: "#F9FAF4"
  surface-pure: "#FFFFFF"
  surface-dim: "#D9DBD5"
  surface-container-low: "#F3F4EE"
  surface-container: "#EDEEE8"
  surface-container-high: "#E8E9E3"
  surface-container-highest: "#E2E3DD"
  on-surface: "#1A1C19"
  on-surface-variant: "#494455"
  outline: "#7A7487"
  outline-variant: "#CAC3D8"
  workbench-page: "#F7F8F3"
  workbench-panel: "#FFFFFF"
  workbench-viewport: "#F1F3ED"
  workbench-line: "#DDE1D8"
  workbench-accent: "#632CE5"
  workbench-muted: "#687064"
  inverse-surface: "#2E312D"
  inverse-on-surface: "#F0F1EB"
typography:
  display:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.05em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "#5420C9"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    typography: "{typography.label}"
  input-field:
    backgroundColor: "{colors.surface-pure}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    typography: "{typography.body}"
  chip:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
    typography: "{typography.label}"
  panel:
    backgroundColor: "{colors.workbench-panel}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "16px"
---

# Design System: 3dlabOpen Workbench

## 1. Overview

**Creative North Star: "The Workshop Bench"**

This is the surface where things get built. Not a dashboard, not a gallery. A workbench: organized, honest, built for long sessions. The visual language borrows from precision instruments and workshop ergonomics. Every surface exists to support a task. Every control exists to give the user exact command over their model.

The system rejects decorative UI. No glassmorphism, no gradient text, no side-stripe borders, no hero-metric templates. Depth comes from tonal layering, not shadows. The palette is warm and grounded. The interface disappears when the user is focused on their 3D model, and reappears with precision when they need controls.

**Key Characteristics:**
- Warm neutral surfaces that recede behind the 3D viewport
- Purple accent reserved for active states and primary actions only
- Mono labels for technical precision, sans-serif body for readability
- Flat tonal layering: surface hierarchy through color temperature, not elevation
- Compact, dense controls that respect screen real estate

## 2. Colors

A warm, grounded palette anchored by a single technical purple accent. Surfaces use a carefully stepped neutral scale from warm off-white to cool gray, never reaching pure white or pure black.

### Primary
- **Technical Purple** (#632CE5): Active states, primary buttons, selected items, focus rings. Used sparingly, maximum ~10% of any screen.
- **Purple Container** (#7C4DFF): Hover states for primary elements, progress indicators.
- **Purple Fixed** (#E8DEFF): Tinted backgrounds for selected chips, active tabs.
- **Purple Fixed Dim** (#CDBDFF): Subtle backgrounds for secondary actions.

### Secondary
- **Workshop Gray** (#5F5E5E): Secondary text, inactive controls, muted labels.
- **Gray Container** (#E2DFDE): Inactive button backgrounds, chip defaults.

### Tertiary
- **Workshop Amber** (#904000): Warnings, attention states, important callouts.
- **Amber Container** (#FFDBC7): Warning backgrounds, status indicators.

### Neutral
- **Workbench Page** (#F7F8F3): Primary page background. The canvas behind everything.
- **Workbench Panel** (#FFFFFF): Card and panel backgrounds. Raised surfaces.
- **Workbench Viewport** (#F1F3ED): 3D viewport background. Slightly dimmer than page.
- **Surface Container Low** (#F3F4EE): Subtle container backgrounds.
- **Surface Container** (#EDEEE8): Default container backgrounds.
- **Surface Container High** (#E8E9E3): Borders, dividers, inactive backgrounds.
- **Surface Container Highest** (#E2E3DD): Strong borders, separators.
- **On Surface** (#1A1C19): Primary text. Near-black with warm undertone.
- **On Surface Variant** (#494455): Secondary text, descriptions.
- **Outline** (#7A7487): Borders, dividers, inactive states.
- **Workbench Line** (#DDE1D8): Grid lines, subtle separators.
- **Workbench Muted** (#687064): Placeholder text, disabled states.

### Named Rules
**The Purple Restraint Rule.** The primary purple (#632CE5) appears on no more than 10% of any given screen. Its rarity is what makes it meaningful. When everything is purple, nothing is.

**The Warm Ground Rule.** No surface reaches pure white (#FFF) or pure black (#000). All neutrals carry a warm green-gray undertone. This is a workshop, not a laboratory.

## 3. Typography

**Display Font:** Hanken Grotesk (with system-ui fallback)
**Body Font:** Hanken Grotesk (with system-ui fallback)
**Label/Mono Font:** JetBrains Mono (with SFMono-Regular fallback)

**Character:** The pairing is technical and precise. Hanken Grotesk is a geometric sans with warm humanist touches, readable at small sizes. JetBrains Mono brings engineering clarity to labels, measurements, and data. The system feels like an instrument panel: every number is trustworthy.

### Hierarchy
- **Display** (800, clamp(2.5rem, 5vw, 4rem), 1.1): Page titles only. The single largest element on any screen.
- **Headline** (700, clamp(1.5rem, 3vw, 2.25rem), 1.2): Section headers within panels.
- **Title** (700, 1.25rem, 1.3): Panel titles, modal headers.
- **Body** (400, 0.875rem, 1.5): Descriptions, instructions, content text. Max line length 65-75ch.
- **Label** (500, 0.6875rem, 1, 0.05em, uppercase): Buttons, chips, badges, tool labels. Always monospaced.
- **Mono** (400, 0.8125rem, 1.4): Measurements, file names, code, numeric inputs.

### Named Rules
**The Mono Label Rule.** All interactive labels (buttons, chips, badges, tool names) use JetBrains Mono in uppercase. This signals precision and technical intent. Body text uses Hanken Grotesk for comfortable reading.

**The Single Display Rule.** Only one element per viewport uses Display scale. If there are two large texts competing, the hierarchy has failed.

## 4. Elevation

Tonal layering only. No box-shadows. Depth is conveyed through surface color temperature: the deeper the layer, the warmer and lighter the surface. The workbench page (#F7F8F3) sits at the bottom, panels (#FFFFFF) float above it, and the viewport (#F1F3ED) is a recessed workspace.

When the user needs to distinguish interactive depth (hover, active, focus), the system uses tonal shifts within the neutral scale, not shadow lifting. A hovered button becomes slightly darker; a focused input gets a purple outline; an active tab gets a purple tint. The surface never "lifts."

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. No shadows, no gradients, no border-fakes. Depth comes from color layering. If it looks like it casts a shadow, the design has drifted.

**The Viewport Recess Rule.** The 3D viewport is always the deepest recessed surface. It should feel like looking into a workspace, not onto a screen. The viewport background (#F1F3ED) is always darker/cooler than the surrounding page (#F7F8F3).

## 5. Components

### Buttons
- **Shape:** Gently curved edges (4px radius)
- **Primary:** Purple background (#632CE5), white text, 8px 16px padding, label typography. Used for the single most important action per screen.
- **Hover:** Darker purple (#5420C9), same padding. Transition: 180ms ease-out.
- **Ghost:** Transparent background, on-surface-variant text. For secondary actions and navigation.
- **Active:** translateY(1px) scale(0.985) for tactile feedback.

### Inputs / Fields
- **Style:** White background (#FFFFFF), subtle border (outline-variant), 4px radius, body typography, 8px 12px padding.
- **Focus:** 2px purple outline (#632CE5) at 70% opacity, 2px offset. No ring glow, no border-color shift.
- **Range Sliders:** Purple accent (#7C4DFF) thumb, subtle track (#E2DFDE), 4px track height, 16px thumb with white border.

### Chips / Tags
- **Style:** Surface-container-high background, on-surface-variant text, full pill shape (9999px radius), label typography, 4px 12px padding.
- **Active:** Purple-fixed background (#E8DEFF), accent text (#4F00D0).
- **Border:** None. Tonal difference only.

### Panels / Cards
- **Corner Style:** 4px radius
- **Background:** Workbench panel (#FFFFFF)
- **Border:** 1px solid surface-container-high (#E8E9E3)
- **Internal Padding:** 16px (md)
- **Shadow Strategy:** None. Flat by default. Depth from page contrast.

### Navigation Tabs
- **Style:** Label typography, uppercase, monospaced. Active tab gets purple text and bottom border. Inactive tabs are on-surface-variant.
- **Transition:** 180ms ease-out for color and border.

### 3D Viewport
- **Background:** Workbench viewport (#F1F3ED)
- **Grid:** Subtle lines (workbench-line #DDE1D8) at 24px spacing
- **Overlay Controls:** White panels with surface-container-high borders, 4px radius, compact label buttons

### Toolbars
- **Background:** Workbench page (#F7F8F3) with surface-container-high bottom border
- **Buttons:** Compact, label typography, icon + text, ghost style by default, primary when active
- **Spacing:** 4px gaps between buttons, 16px section separators

## 6. Do's and Don'ts

### Do:
- **Do** use the purple accent (#632CE5) only for active states and the single most important action per screen. Its rarity is the point.
- **Do** use tonal layering for depth. Page (#F7F8F3) < Panel (#FFFFFF) < Viewport (#F1F3ED). Never shadows.
- **Do** use JetBrains Mono for all labels, measurements, and technical data. It signals precision.
- **Do** keep controls compact and dense. This is a desktop tool for long sessions, not a mobile app.
- **Do** use the warm neutral scale for all surfaces. Every color carries a green-gray undertone.
- **Do** provide clear focus-visible states (2px purple outline, 2px offset) for keyboard navigation.
- **Do** use prefers-reduced-motion to disable animations for users who need it.

### Don't:
- **Don't** use gradients, glassmorphism, or backdrop-filter blur. This is a workshop, not a showcase.
- **Don't** use border-left or border-right greater than 1px as a colored accent stripe. Never intentional.
- **Don't** use gradient text (background-clip: text). Use solid colors and weight contrast.
- **Don't** wrap everything in cards. Most things don't need a container.
- **Don't** use hero-metric templates (big number + small label + gradient accent). SaaS cliché.
- **Don't** use modal dialogs as the first resort. Exhaust inline and progressive alternatives.
- **Don't** use pure white (#FFF) or pure black (#000). Always tint toward the warm neutral scale.
- **Don't** animate CSS layout properties (width, height, padding). Use transforms and opacity only.
- **Don't** use bounce or elastic easing. Ease-out with exponential curves only.

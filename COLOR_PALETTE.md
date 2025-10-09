# Campaign Color Palette

This document outlines the new campaign color palette that has been implemented across the platform.

## Primary Campaign Colors

These are the main colors for the campaign and should be used prominently for key components, headings, and calls-to-action.

### Primary Blue 1
- **Hex**: #1D8AD1
- **CSS Variable**: `--campaign-blue1`
- **Tailwind Class**: `bg-campaign-blue1` / `text-campaign-blue1`
- **Usage**: Primary buttons, key metrics, important UI elements

### Primary Blue 2
- **Hex**: #5378F1
- **CSS Variable**: `--campaign-blue2`
- **Tailwind Class**: `bg-campaign-blue2` / `text-campaign-blue2`
- **Usage**: Secondary buttons, alternative UI elements, gradients

## Secondary & Neutral Colors

These colors are for backgrounds, text, and supporting elements.

### Black (Text/Accent)
- **Hex**: #000000
- **CSS Variable**: `--foreground` (light mode) / `--background` (dark mode)
- **Usage**: Primary text color in light mode

### Campaign Red (Accent/CTA)
- **Hex**: #E32A18
- **CSS Variable**: `--campaign-red`
- **Tailwind Class**: `bg-campaign-red` / `text-campaign-red`
- **Usage**: Error states, destructive actions, important alerts

### Gold/Bronze (Tertiary Accent)
- **Hex**: #D4AF37
- **CSS Variable**: `--campaign-gold`
- **Tailwind Class**: `bg-campaign-gold` / `text-campaign-gold`
- **Usage**: Special highlights, premium features, warnings

### Light Gray/Off-White (Background)
- **Hex**: #EDF2F9
- **CSS Variable**: `--campaign-gray` / `--background`
- **Tailwind Class**: `bg-campaign-gray` / `bg-background`
- **Usage**: Backgrounds, cards, neutral UI elements

## Implementation Examples

### Using in Components
```jsx
// Using campaign colors in components
<Button variant="campaignBlue1">Primary Action</Button>
<Button variant="campaignRed">Delete</Button>
<Badge variant="campaignGold">Premium</Badge>
```

### Using in CSS
```css
/* Using CSS variables */
.hero-section {
  background: linear-gradient(135deg, var(--campaign-blue1), var(--campaign-blue2));
}
```

### Using Tailwind Classes
```jsx
// Using Tailwind classes directly
<div className="bg-campaign-blue1 text-white">
  Primary content area
</div>
```

## Dark Mode Considerations

In dark mode, the campaign colors remain consistent to maintain brand identity:
- Primary Blue 1: #1D8AD1
- Primary Blue 2: #5378F1
- Campaign Red: #E32A18
- Gold/Bronze: #D4AF37

These colors automatically adapt to have appropriate contrast against dark backgrounds...
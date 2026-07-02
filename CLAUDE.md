# Hewett Will Do It 2026 — Campaign Website

## Project Overview
This is the official campaign website for Seth Hewett, candidate 
for Bakersfield City Council Ward 3, 2026 election. The site 
should feel professional, warm, slightly rustic, and enthusiastic 
without being cheesy.

## Tech Stack
- Plain HTML5, CSS3, and vanilla JavaScript
- No frameworks, no dependencies, no npm
- All files self-contained and easy to edit
- Mobile responsive

## File Structure
website/
├── index.html           # Page 1: Platform (landing page)
├── meet-seth.html       # Page 2: Meet the Candidate
├── get-involved.html    # Page 3: Donate / Involve / Feedback
├── styles/
│   └── main.css         # All styles in one file
├── scripts/
│   └── main.js          # All JavaScript in one file
└── assets/
├── logo/            # Logo files
└── images/          # Photos and media

## Design System

### Colors
- Navy: #0B1F3A (primary, headers, nav)
- Green: #2D6A4F (accents, buttons, highlights)
- Cream: #F5F0E8 (backgrounds, warmth)
- Gold: #C9883A (energy, accents, hover states)
- White: #FFFFFF (cards, clean sections)

### Typography
- Headlines: 'Playfair Display', serif (Google Font)
- Body: 'Inter', sans-serif (Google Font)
- Both loaded via Google Fonts CDN

### Feel
Professional but warm. Think Kern County — not Silicon Valley,
not stiff government. Slightly rustic. Never cheesy.

## Pages

### Page 1: index.html (Platform)
- Navigation bar with logo and links to all three pages
- Hero section: name, title, tagline
- 10 interactive flip tiles (CSS flip animation on click)
- Tiles organized into categories
- Footer with social links

### Page 2: meet-seth.html (Meet the Candidate)
- Navigation bar (same across all pages)
- Photo placeholder at top
- Q&A sections with expandable content
- Same footer

### Page 3: get-involved.html (Get Involved)
- Navigation bar (same across all pages)
- Donate section (placeholder — "Coming Soon")
- Volunteer/contact form
- Resident feedback QR placeholder
- Social media links
- Same footer

## Rules
- Always use semantic HTML (header, main, section, footer, nav)
- All pages share the same nav and footer
- Never use inline styles — all CSS goes in main.css
- JavaScript only for interactivity (tile flips, mobile menu)
- Images use placeholder divs until real photos are added
- Keep it simple and easy to update
- Comment your code clearly
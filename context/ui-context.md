# UI Context — Real-Time Service Marketplace

## Theme

The user interface follows a modern, technical, high-contrast dark theme designed for rapid marketplace monitoring. Backgrounds use deep slate/zinc tones with subtle borders, allowing real-time offer updates, status badges, and interactive forms to stand out clearly without visual clutter.

## Colors

All components use CSS custom properties defined in global CSS:

| Role | CSS Variable | Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Page Background** | `--bg-base` | `#090d16` | Main application background |
| **Surface Background** | `--bg-surface` | `#111827` | Cards, panels, modal dialogs |
| **Surface Elevated** | `--bg-elevated` | `#1f2937` | Hover states, active list items |
| **Border Default** | `--border-default` | `#1f293d` | Dividers, card borders, form boundaries |
| **Border Focus** | `--border-focus` | `#6366f1` | Input focus rings, selected items |
| **Primary Text** | `--text-primary` | `#f9fafb` | Headers, active values, high contrast |
| **Secondary Text** | `--text-secondary` | `#9ca3af` | Labels, descriptions, timestamps |
| **Muted Text** | `--text-muted` | `#6b7280` | Placeholders, inactive captions |
| **Primary Accent** | `--accent-primary` | `#6366f1` | Primary action buttons, active tabs (Indigo) |
| **Primary Accent Hover** | `--accent-hover` | `#4f46e5` | Button hover states |
| **Success / Open** | `--state-success` | `#10b981` | Open requests, accepted offers, paid status (Emerald) |
| **Warning / Pending** | `--state-warning` | `#f59e0b` | Pending offers, awaiting review (Amber) |
| **Error / Closed** | `--state-error` | `#ef4444` | Validation errors, rejected offers (Rose) |
| **Connection Pulse** | `--state-online` | `#22c55e` | Socket.IO connected status indicator |

## Typography

| Role | Font Family | Variable | Usage |
| :--- | :--- | :--- | :--- |
| **UI Body & Headings** | Inter, -apple-system, sans-serif | `--font-sans` | Standard labels, titles, dialogs |
| **Monospace / Technical** | JetBrains Mono, monospace | `--font-mono` | IDs, currency amounts, timestamps, tokens |

## Border Radius Scale

| Context | Class / Value |
| :--- | :--- |
| **Inputs, Badges & Small Buttons** | `rounded-md` (`6px`) |
| **Cards, Feed Items & Panels** | `rounded-lg` (`8px`) |
| **Modals, Drawers & Popovers** | `rounded-xl` (`12px`) |

## Component Library & Icons

- **Component Layer**: Next.js 16 App Router with Turbopack, React 19, and Tailwind CSS utility classes with structured CSS variable bindings.
- **Icons**: Lucide React (stroke width: `1.75px` or `2px`). Sizes: `w-4 h-4` for inline badges/buttons, `w-5 h-5` for action bars and headers.
- **Real-Time Indicators**:
  - Live pulse indicator in navigation bar (`animate-ping` dot showing Socket.IO connection status).
  - Subtle highlight fade animation (`animate-fade-in-glow`) when a new offer or message arrives in real time.

## Key Layout Patterns

1. **Header & Navigation Bar**:
   - Fixed top header displaying logo, active role pill (`Customer` / `Provider`), WebSocket status pill (green pulse = connected, red = disconnected), and user email with Logout button.
2. **Customer Workspace (`/customer/requests`)**:
   - Left pane (or top bar): "Create Service Request" card with validated fields (Title, Description, Budget).
   - Main pane: List of customer's active requests. Clicking a request opens the "Offer Room" showing all incoming offers with real-time stream updates and the "Accept & Pay" trigger button.
3. **Provider Marketplace (`/provider/browse`)**:
   - Grid / feed of open requests. New requests broadcast via Socket.IO appear at the top with an "Updated" flash.
   - Expandable offer submission drawer: Price input (validated > 0) + proposal text area.
4. **Payment Modal (Stripe Elements)**:
   - Centered overlay with backdrop blur.
   - Shows locked service title, provider name, and verified offer price.
   - Hosts Stripe CardElement / PaymentElement with error alert box and "Pay $X" confirmation button.
5. **Real-Time Chat Panel (`/chat/[requestId]`)**:
   - Split view or modal: Top bar with counterparty name, middle scrollable message history with auto-scroll to bottom on new messages, bottom message input with Enter-to-send.

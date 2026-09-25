# Rule: UI Context & Design Standards

Every frontend implementation task must adhere to the design system in `context/ui-context.md`:

- **Aesthetic**: Modern, dark technical workspace with high contrast and subtle borders.
- **Tokens**: Use CSS variables for all colors (`--bg-base: #090d16`, `--bg-surface: #111827`, `--accent-primary: #6366f1`, `--state-success: #10b981`, `--state-warning: #f59e0b`, `--state-error: #ef4444`). Never use raw hardcoded hex codes.
- **Typography**: Inter for UI text, JetBrains Mono for monetary values, IDs, and timestamps.
- **Real-Time Indicators**: Live connection indicator for Socket.IO state in navigation bar; highlight pulse when new offers or messages arrive.
- **Forms**: Clean validation with inline feedback, accessible labels, disabled submit button during async loading.
- Source of truth: `context/ui-context.md`.

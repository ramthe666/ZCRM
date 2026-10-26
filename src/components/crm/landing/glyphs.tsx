import { cn } from "@/lib/utils"

/**
 * IntegrationGlyph — hand-crafted, simplified geometric marks for the
 * services Nova CRM connects with. These are original abstractions
 * (not exact trademark logos), drawn as inline SVG on a 24×24 grid.
 *
 * Colors: `currentColor` for neutrals + emerald for brand accents.
 * Negative-space details use `var(--background)` so they adapt to
 * light/dark mode automatically.
 *
 * Reused by both the marketing landing page and the workspace
 * Integrations settings page — keep this file importable standalone.
 */
export function IntegrationGlyph({
  provider,
  className,
}: {
  provider: string
  className?: string
}) {
  const key = provider.trim().toLowerCase()

  switch (key) {
    case "supabase":
      // Stylized green bolt
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <path
            d="M13.6 2.2 5.4 13.5h4.9L8.4 21.8l8.3-11.4h-4.9l1.8-8.2Z"
            fill="#10b981"
          />
        </svg>
      )

    case "vercel":
      // Neutral triangle
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <path d="M12 3.2 21 20.8H3L12 3.2Z" fill="currentColor" />
        </svg>
      )

    case "github":
      // Abstract cat face
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <path d="M6.4 9.8 5 4.2l5.4 2.8Z" fill="currentColor" />
          <path d="M17.6 9.8 19 4.2l-5.4 2.8Z" fill="currentColor" />
          <circle cx="12" cy="13.6" r="6.2" fill="currentColor" />
          <circle cx="9.9" cy="13.2" r="1.05" fill="var(--background)" />
          <circle cx="14.1" cy="13.2" r="1.05" fill="var(--background)" />
        </svg>
      )

    case "resend":
      // Paper plane with fold
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <path
            d="M21.6 2.7 3.6 10.3l6.3 2.7 2.7 6.3 9-16.6Z"
            fill="currentColor"
          />
          <path
            d="M21.6 2.7 9.9 13l2.7 6.3 9-16.6Z"
            fill="var(--background)"
            opacity="0.22"
          />
        </svg>
      )

    case "whatsapp":
      // Speech bubble + handset
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <path
            d="M12 2.8a9.2 9.2 0 0 0-7.9 13.9l-1.5 4.5 4.6-1.4A9.2 9.2 0 1 0 12 2.8Z"
            fill="#10b981"
          />
          <g transform="translate(5.4 5.4) scale(0.55)">
            <path
              d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"
              fill="var(--background)"
            />
          </g>
        </svg>
      )

    case "slack":
      // Four rounded quadrants
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <rect x="3" y="3" width="7.8" height="7.8" rx="2.7" fill="#10b981" />
          <rect
            x="13.2"
            y="3"
            width="7.8"
            height="7.8"
            rx="2.7"
            fill="currentColor"
          />
          <rect
            x="3"
            y="13.2"
            width="7.8"
            height="7.8"
            rx="2.7"
            fill="currentColor"
          />
          <rect
            x="13.2"
            y="13.2"
            width="7.8"
            height="7.8"
            rx="2.7"
            fill="currentColor"
            opacity="0.55"
          />
        </svg>
      )

    case "stripe":
      // Monoline "S"
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <path
            d="M16.2 7.4c-1.1-1.5-2.7-2.2-4.5-2.2-2.5 0-4.3 1.4-4.3 3.4 0 4.5 9 2.3 9 6.9 0 2.1-1.9 3.3-4.5 3.3-2.1 0-3.8-.9-4.8-2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )

    case "zapier":
      // Asterisk / orbit
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <path
            d="M12 4.6v14.8M4.6 12h14.8M6.8 6.8l10.4 10.4M17.2 6.8 6.8 17.2"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="2.1" fill="#10b981" />
        </svg>
      )

    case "google":
    case "google workspace":
      // Abstract 3-color ring (emerald / amber / rose — no blue)
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <g transform="rotate(-90 12 12)">
            <circle
              cx="12"
              cy="12"
              r="8.4"
              fill="none"
              stroke="#10b981"
              strokeWidth="3"
              strokeDasharray="13.2 4.4"
            />
            <circle
              cx="12"
              cy="12"
              r="8.4"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeDasharray="13.2 4.4"
              strokeDashoffset="-17.6"
            />
            <circle
              cx="12"
              cy="12"
              r="8.4"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="3"
              strokeDasharray="13.2 4.4"
              strokeDashoffset="-35.2"
            />
          </g>
        </svg>
      )

    case "mailchimp":
      // Monkey face with crown
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <circle cx="4.6" cy="10.2" r="2.7" fill="currentColor" />
          <circle cx="19.4" cy="10.2" r="2.7" fill="currentColor" />
          <circle cx="12" cy="13.4" r="6.3" fill="currentColor" />
          <path
            d="M8.2 8.6 9.6 4.6l2.4 2.2 2.4-2.2 1.4 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9.8" cy="13" r="1" fill="var(--background)" />
          <circle cx="14.2" cy="13" r="1" fill="var(--background)" />
        </svg>
      )

    case "twilio":
      // Rounded square with four dots
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <rect
            x="3.6"
            y="3.6"
            width="16.8"
            height="16.8"
            rx="5.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <circle cx="8.4" cy="8.4" r="1.9" fill="currentColor" />
          <circle cx="15.6" cy="8.4" r="1.9" fill="currentColor" />
          <circle cx="8.4" cy="15.6" r="1.9" fill="currentColor" />
          <circle cx="15.6" cy="15.6" r="1.9" fill="currentColor" />
        </svg>
      )

    case "hubspot":
      // Three connected nodes / sprocket
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <circle
            cx="13.6"
            cy="10.4"
            r="3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
          />
          <circle cx="13.6" cy="10.4" r="1.2" fill="#10b981" />
          <path
            d="M11.2 13.2 6.6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M15.9 12.9l3 3.4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="5.4" cy="19.2" r="2.3" fill="currentColor" />
          <circle cx="19.6" cy="17.6" r="2.3" fill="currentColor" />
        </svg>
      )

    default:
      // Generic puzzle piece fallback
      return (
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn("size-5 shrink-0", className)}
        >
          <path
            d="M4 4h5.8a2.2 2.2 0 0 1 4.4 0H20v5.8a2.2 2.2 0 0 1 0 4.4V20h-5.8a2.2 2.2 0 0 1-4.4 0H4v-5.8a2.2 2.2 0 0 1 0-4.4V4Z"
            fill="currentColor"
          />
        </svg>
      )
  }
}

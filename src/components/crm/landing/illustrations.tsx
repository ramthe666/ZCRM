import { cn } from "@/lib/utils"

/**
 * Hand-crafted inline SVG illustrations for the Nova CRM landing page.
 * No external images are used anywhere — everything below is vector art.
 * Shapes are themed with Tailwind fill- and stroke- color classes so
 * they adapt to light & dark mode automatically.
 */

/* ------------------------------------------------------------------ */
/* Logo mark — emerald gradient tile, white spark, orbit ring          */
/* ------------------------------------------------------------------ */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn("size-8", className)}
    >
      <defs>
        <linearGradient
          id="nova-mark-gradient"
          x1="4"
          y1="2"
          x2="28"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#nova-mark-gradient)" />
      <path
        d="M16 7c.7 4.3 2.7 6.6 7.2 7.4-4.5.8-6.5 3.1-7.2 7.4-.7-4.3-2.7-6.6-7.2-7.4C13.3 13.6 15.3 11.3 16 7Z"
        fill="#fff"
      />
      <ellipse
        cx="16"
        cy="16"
        rx="12.6"
        ry="5"
        transform="rotate(-28 16 16)"
        fill="none"
        stroke="rgba(255,255,255,.55)"
        strokeWidth="1.5"
      />
      <circle cx="27.3" cy="12" r="1.9" fill="#fff" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Dashboard mockup — stylized CRM app (sidebar, KPIs, charts, kanban) */
/* ------------------------------------------------------------------ */

const KPI_CARDS = [
  {
    x: 224,
    label: "Open pipeline",
    value: "$1.24M",
    delta: "+12.4%",
    tone: "emerald" as const,
    spark: [198, 190, 193, 176, 182, 166],
    color: "#10b981",
  },
  {
    x: 467,
    label: "Win rate",
    value: "38.5%",
    delta: "+0.8 pt",
    tone: "emerald" as const,
    spark: [192, 195, 186, 189, 178, 174],
    color: "#14b8a6",
  },
  {
    x: 710,
    label: "Avg. deal size",
    value: "$18.2K",
    delta: "-2.1%",
    tone: "rose" as const,
    spark: [176, 182, 170, 178, 168, 158],
    color: "#f59e0b",
  },
]

const BARS = [
  { label: "Leads", h: 46 },
  { label: "Qualify", h: 66 },
  { label: "Demo", h: 56 },
  { label: "Propose", h: 88 },
  { label: "Negotiate", h: 72 },
  { label: "Won", h: 104 },
  { label: "Lost", h: 62 },
]

const KANBAN = [
  {
    x: 224,
    title: "Qualification",
    count: "12",
    dot: "#10b981",
    cards: [
      { title: "Acme Corp renewal", amount: "$24,000", tag: "Renewal", who: "M", tone: "#059669" },
      { title: "Globex pilot", amount: "$8,500", tag: "New", who: "R", tone: "#0d9488" },
    ],
  },
  {
    x: 467,
    title: "Proposal",
    count: "8",
    dot: "#f59e0b",
    cards: [
      { title: "Initech upsell", amount: "$32,000", tag: "Upsell", who: "S", tone: "#f59e0b" },
      { title: "Umbrella demo", amount: "$5,200", tag: "Demo", who: "L", tone: "#f43f5e" },
    ],
  },
  {
    x: 710,
    title: "Won",
    count: "5",
    dot: "#14b8a6",
    cards: [
      { title: "Stark Industries", amount: "$120,000", tag: "Annual", who: "T", tone: "#059669" },
      { title: "Wayne Enterprises", amount: "$64,000", tag: "Annual", who: "B", tone: "#0d9488" },
    ],
  },
]

function KpiCard({
  x,
  label,
  value,
  delta,
  tone,
  spark,
  color,
}: (typeof KPI_CARDS)[number]) {
  const points = spark.map((dy, i) => `${x + 124 + i * 16},${dy}`).join(" ")
  const lastX = x + 124 + (spark.length - 1) * 16
  return (
    <g>
      <rect x={x} y={132} width={226} height={84} rx={14} className="fill-card stroke-border" strokeWidth={1} />
      <text x={x + 16} y={156} fontSize={11} className="fill-muted-foreground">{label}</text>
      <text x={x + 16} y={182} fontSize={20} fontWeight={700} className="fill-foreground">{value}</text>
      <rect
        x={x + 16}
        y={192}
        width={60}
        height={20}
        rx={10}
        className={tone === "emerald" ? "fill-emerald-500/15" : "fill-rose-500/15"}
      />
      <text
        x={x + 46}
        y={206}
        fontSize={10.5}
        fontWeight={600}
        textAnchor="middle"
        className={tone === "emerald" ? "fill-emerald-600 dark:fill-emerald-400" : "fill-rose-600 dark:fill-rose-400"}
      >
        {delta}
      </text>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={spark[spark.length - 1]} r={3} fill={color} />
    </g>
  )
}

export function DashboardMockup({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 960 600"
      role="img"
      aria-label="Stylized preview of the Nova CRM dashboard showing KPI cards, pipeline charts, and a kanban board"
      focusable="false"
      className={cn("block w-full", className)}
    >
      {/* ---------------- Sidebar ---------------- */}
      <rect x={0} y={0} width={200} height={600} className="fill-muted/60" />
      <rect x={16} y={16} width={30} height={30} rx={9} fill="#059669" />
      <path
        d="M31 17.5c.5 3 1.9 4.6 5 5.2-3.1.6-4.5 2.2-5 5.2-.5-3-1.9-4.6-5-5.2 3.1-.6 4.5-2.2 5-5.2Z"
        fill="#fff"
      />
      <text x={56} y={36} fontSize={14} fontWeight={700} className="fill-foreground">
        Nova CRM
      </text>
      <line x1={16} y1={62} x2={184} y2={62} className="stroke-border" strokeWidth={1} />

      {/* Nav rows */}
      <rect x={12} y={78} width={176} height={34} rx={10} className="fill-emerald-500/10" />
      <rect x={22} y={85} width={20} height={20} rx={6} className="fill-emerald-600" />
      <rect x={50} y={92} width={92} height={9} rx={4.5} className="fill-foreground/60" />
      {[1, 2, 3, 4, 5].map((i) => {
        const y = 78 + i * 42
        return (
          <g key={i}>
            <rect x={22} y={y + 7} width={20} height={20} rx={6} className="fill-muted-foreground/25" />
            <rect x={50} y={y + 14} width={86} height={9} rx={4.5} className="fill-muted-foreground/25" />
          </g>
        )
      })}

      {/* Shortcuts */}
      <text x={22} y={352} fontSize={9} letterSpacing={1.5} className="fill-muted-foreground/80">
        SHORTCUTS
      </text>
      <circle cx={32} cy={372} r={8} fill="#0d9488" opacity={0.75} />
      <rect x={48} y={368} width={70} height={8} rx={4} className="fill-muted-foreground/25" />
      <circle cx={32} cy={414} r={8} fill="#f59e0b" opacity={0.75} />
      <rect x={48} y={410} width={56} height={8} rx={4} className="fill-muted-foreground/25" />

      {/* Sidebar user */}
      <line x1={16} y1={536} x2={184} y2={536} className="stroke-border" strokeWidth={1} />
      <circle cx={34} cy={560} r={15} fill="#0d9488" />
      <text x={34} y={564} fontSize={10} fontWeight={600} textAnchor="middle" fill="#fff">
        AK
      </text>
      <rect x={58} y={552} width={86} height={8} rx={4} className="fill-muted-foreground/30" />
      <rect x={58} y={566} width={54} height={6} rx={3} className="fill-muted-foreground/20" />

      {/* ---------------- Top bar ---------------- */}
      <line x1={200} y1={56} x2={960} y2={56} className="stroke-border" strokeWidth={1} />
      <rect x={224} y={14} width={240} height={28} rx={14} className="fill-muted" />
      <circle cx={240} cy={27} r={5} fill="none" className="stroke-muted-foreground" strokeWidth={1.6} />
      <line x1={244} y1={31} x2={250} y2={37} className="stroke-muted-foreground" strokeWidth={1.6} strokeLinecap="round" />
      <text x={262} y={32} fontSize={11} className="fill-muted-foreground">
        Search deals, contacts…
      </text>
      {/* Settings */}
      <circle cx={846} cy={28} r={16} className="fill-muted" />
      <circle cx={846} cy={28} r={5.5} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} />
      <path d="M846 20.5V18M846 38v-2.5M838.5 28H836M856 28h-2.5" className="stroke-muted-foreground" strokeWidth={1.5} strokeLinecap="round" />
      {/* Bell */}
      <circle cx={886} cy={28} r={16} className="fill-muted" />
      <path
        d="M886 20.5c-2.9 0-4.7 2-4.7 4.7v3.1l-1.5 2.5h12.4l-1.5-2.5v-3.1c0-2.7-1.8-4.7-4.7-4.7Z"
        className="fill-muted-foreground"
      />
      <circle cx={886} cy={33} r={1.5} className="fill-muted-foreground" />
      <circle cx={895} cy={17.5} r={4} fill="#f59e0b" />
      {/* Avatar */}
      <circle cx={928} cy={28} r={17} fill="#059669" />
      <text x={928} y={31.5} fontSize={9.5} fontWeight={600} textAnchor="middle" fill="#fff">
        JD
      </text>

      {/* ---------------- Page header ---------------- */}
      <text x={224} y={92} fontSize={19} fontWeight={700} className="fill-foreground">
        Revenue overview
      </text>
      <text x={224} y={112} fontSize={11.5} className="fill-muted-foreground">
        Q4 2025 · Updated 2 min ago
      </text>
      <rect x={806} y={70} width={130} height={30} rx={15} className="fill-muted stroke-border" strokeWidth={1} />
      <text x={856} y={89} fontSize={11} textAnchor="middle" className="fill-muted-foreground">
        Last 30 days
      </text>
      <path d="m914 84 4 4 4-4" fill="none" className="stroke-muted-foreground" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />

      {/* ---------------- KPI cards ---------------- */}
      {KPI_CARDS.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}

      {/* ---------------- Bar chart card ---------------- */}
      <rect x={224} y={232} width={432} height={164} rx={14} className="fill-card stroke-border" strokeWidth={1} />
      <text x={240} y={258} fontSize={12.5} fontWeight={600} className="fill-foreground">
        Pipeline by stage
      </text>
      <circle cx={508} cy={253} r={4} fill="#10b981" />
      <text x={516} y={257} fontSize={10} className="fill-muted-foreground">
        This quarter
      </text>
      <circle cx={592} cy={253} r={4} fill="#f59e0b" />
      <text x={600} y={257} fontSize={10} className="fill-muted-foreground">
        Goal
      </text>
      {BARS.map((b, i) => {
        const bx = 244 + i * 60
        const by = 376 - b.h
        return (
          <g key={b.label}>
            <rect
              x={bx}
              y={by}
              width={32}
              height={b.h}
              rx={7}
              className={i === 5 ? "fill-emerald-600" : "fill-emerald-500/70"}
            />
            <text x={bx + 16} y={390} fontSize={8.5} textAnchor="middle" className="fill-muted-foreground">
              {b.label}
            </text>
          </g>
        )
      })}
      <line x1={244} y1={266} x2={636} y2={266} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 5" opacity={0.9} />

      {/* ---------------- Donut card ---------------- */}
      <rect x={672} y={232} width={264} height={164} rx={14} className="fill-card stroke-border" strokeWidth={1} />
      <text x={688} y={258} fontSize={12.5} fontWeight={600} className="fill-foreground">
        Leads by source
      </text>
      <g transform="rotate(-90 804 318)">
        <circle cx={804} cy={318} r={40} fill="none" stroke="#059669" strokeWidth={16} strokeDasharray="100 151.3" />
        <circle cx={804} cy={318} r={40} fill="none" stroke="#14b8a6" strokeWidth={16} strokeDasharray="72 179.3" strokeDashoffset={-106} />
        <circle cx={804} cy={318} r={40} fill="none" stroke="#f59e0b" strokeWidth={16} strokeDasharray="58 193.3" strokeDashoffset={-184} />
      </g>
      <text x={804} y={315} fontSize={15} fontWeight={700} textAnchor="middle" className="fill-foreground">
        2,842
      </text>
      <text x={804} y={331} fontSize={9} textAnchor="middle" className="fill-muted-foreground">
        total leads
      </text>
      <circle cx={690} cy={369} r={3.5} fill="#059669" />
      <text x={698} y={372.5} fontSize={9.5} className="fill-muted-foreground">
        Ads · 45%
      </text>
      <circle cx={790} cy={369} r={3.5} fill="#14b8a6" />
      <text x={798} y={372.5} fontSize={9.5} className="fill-muted-foreground">
        Referrals · 30%
      </text>
      <circle cx={690} cy={383} r={3.5} fill="#f59e0b" />
      <text x={698} y={386.5} fontSize={9.5} className="fill-muted-foreground">
        Organic · 25%
      </text>

      {/* ---------------- Kanban columns ---------------- */}
      {KANBAN.map((col) => (
        <g key={col.title}>
          <rect x={col.x} y={404} width={226} height={192} rx={14} className="fill-muted/40" />
          <circle cx={col.x + 10} cy={424} r={4.5} fill={col.dot} />
          <text x={col.x + 22} y={428} fontSize={11.5} fontWeight={600} className="fill-foreground">
            {col.title}
          </text>
          <rect x={col.x + 180} y={412} width={38} height={18} rx={9} className="fill-muted" />
          <text x={col.x + 199} y={424.5} fontSize={9.5} fontWeight={600} textAnchor="middle" className="fill-muted-foreground">
            {col.count}
          </text>
          {col.cards.map((card, i) => {
            const cy = 442 + i * 66
            return (
              <g key={card.title}>
                <rect x={col.x} y={cy} width={226} height={58} rx={12} className="fill-card stroke-border" strokeWidth={1} />
                <text x={col.x + 12} y={cy + 24} fontSize={10.5} fontWeight={600} className="fill-foreground">
                  {card.title}
                </text>
                <rect x={col.x + 158} y={cy + 12} width={56} height={15} rx={7.5} className="fill-muted" />
                <text x={col.x + 186} y={cy + 22.5} fontSize={8} textAnchor="middle" className="fill-muted-foreground">
                  {card.tag}
                </text>
                <text x={col.x + 12} y={cy + 47} fontSize={10.5} fontWeight={700} className="fill-emerald-600 dark:fill-emerald-400">
                  {card.amount}
                </text>
                <circle cx={col.x + 204} cy={cy + 42} r={10.5} fill={card.tone} />
                <text x={col.x + 204} y={cy + 45.5} fontSize={8} fontWeight={600} textAnchor="middle" fill="#fff">
                  {card.who}
                </text>
              </g>
            )
          })}
        </g>
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Avatar initials — colored circle + initials                         */
/* ------------------------------------------------------------------ */

const AVATAR_TONES: Record<string, string> = {
  emerald: "fill-emerald-600",
  teal: "fill-teal-600",
  amber: "fill-amber-500",
  rose: "fill-rose-500",
}

export function AvatarInitials({
  initials,
  tone = "emerald",
  className,
}: {
  initials: string
  tone?: "emerald" | "teal" | "amber" | "rose"
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 44 44"
      role="img"
      aria-label={`${initials} avatar`}
      focusable="false"
      className={cn("size-11 shrink-0", className)}
    >
      <circle cx={22} cy={22} r={22} className={AVATAR_TONES[tone]} />
      <text x={22} y={27.5} textAnchor="middle" fontSize={14.5} fontWeight={700} fill="#fff">
        {initials}
      </text>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Fictional company wordmarks                                         */
/* ------------------------------------------------------------------ */

export const TRUSTED_BRANDS = ["Helios", "Quantia", "Northbeam", "Lumen Labs", "Vertexa"] as const

export function Wordmark({
  name,
  className,
}: {
  name: (typeof TRUSTED_BRANDS)[number]
  className?: string
}) {
  switch (name) {
    case "Helios":
      return (
        <svg viewBox="0 0 104 26" role="img" aria-label="Helios" focusable="false" className={cn("h-6 w-auto", className)}>
          <g stroke="#f59e0b" strokeWidth={2} strokeLinecap="round">
            <circle cx={13} cy={13} r={3.6} fill="none" />
            <path d="M13 4.2v3.2M13 18.6v3.2M4.2 13h3.2M16.6 13h3.2M6.8 6.8 9 9M19.2 19.2 17 17M19.2 6.8 17 9M6.8 19.2 9 17" />
          </g>
          <text x={28} y={17.5} fontSize={13} fontWeight={700} letterSpacing={3} fill="currentColor">
            HELIOS
          </text>
        </svg>
      )
    case "Quantia":
      return (
        <svg viewBox="0 0 116 26" role="img" aria-label="Quantia" focusable="false" className={cn("h-6 w-auto", className)}>
          <rect x={2} y={4.5} width={11.5} height={11.5} rx={3.5} fill="none" stroke="#10b981" strokeWidth={2.2} />
          <rect x={9.5} y={10} width={11.5} height={11.5} rx={3.5} fill="#10b981" />
          <text x={28} y={17.5} fontSize={13} fontWeight={700} letterSpacing={3} fill="currentColor">
            QUANTIA
          </text>
        </svg>
      )
    case "Northbeam":
      return (
        <svg viewBox="0 0 138 26" role="img" aria-label="Northbeam" focusable="false" className={cn("h-6 w-auto", className)}>
          <path d="M2 16.5 13 4.5l11 12" fill="none" stroke="#14b8a6" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7.5 20.5 13 14.5l5.5 6" fill="none" stroke="#14b8a6" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
          <text x={28} y={17.5} fontSize={13} fontWeight={700} letterSpacing={3} fill="currentColor">
            NORTHBEAM
          </text>
        </svg>
      )
    case "Lumen Labs":
      return (
        <svg viewBox="0 0 148 26" role="img" aria-label="Lumen Labs" focusable="false" className={cn("h-6 w-auto", className)}>
          <circle cx={13} cy={13} r={8.4} fill="none" stroke="#10b981" strokeWidth={2.2} />
          <circle cx={18} cy={8} r={3.8} fill="#10b981" />
          <text x={28} y={17.5} fontSize={13} fontWeight={700} letterSpacing={3} fill="currentColor">
            LUMEN LABS
          </text>
        </svg>
      )
    case "Vertexa":
      return (
        <svg viewBox="0 0 116 26" role="img" aria-label="Vertexa" focusable="false" className={cn("h-6 w-auto", className)}>
          <path d="M2.5 5.5 11.5 21l9-15.5" fill="none" stroke="#059669" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={21} cy={5.5} r={2.3} fill="#059669" />
          <text x={28} y={17.5} fontSize={13} fontWeight={700} letterSpacing={3} fill="currentColor">
            VERTEXA
          </text>
        </svg>
      )
  }
}

/* ------------------------------------------------------------------ */
/* Decorative rings for the final CTA panel                            */
/* ------------------------------------------------------------------ */

export function CtaRings({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 420"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      className={cn("block", className)}
    >
      {[70, 130, 190, 250, 310].map((r) => (
        <circle key={r} cx={1000} cy={210} r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth={1.5} />
      ))}
      {[46, 96, 146].map((r) => (
        <circle key={r} cx={120} cy={420} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={1.5} />
      ))}
      <path
        d="M180 80c.8 5.4 3.4 8.4 9.2 9.4-5.8 1-8.4 4-9.2 9.4-.8-5.4-3.4-8.4-9.2-9.4 5.8-1 8.4-4 9.2-9.4Z"
        fill="rgba(255,255,255,.22)"
      />
      <path
        d="M1070 84c.6 4 2.5 6.2 6.8 7-4.3.8-6.2 3-6.8 7-.6-4-2.5-6.2-6.8-7 4.3-.8 6.2-3 6.8-7Z"
        fill="rgba(255,255,255,.16)"
      />
    </svg>
  )
}

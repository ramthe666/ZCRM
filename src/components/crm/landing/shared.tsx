'use client'

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { animate, motion, useInView, useReducedMotion, type Variants } from 'framer-motion'

import { cn } from '@/lib/utils'

/** Shared easing curve used across the landing page (150–400ms feel). */
export const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1]

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
}

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

/** Fade-up on scroll into view (respects prefers-reduced-motion). */
export function Reveal({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once: true, margin: '-72px' }}
      variants={fadeUp}
    >
      {children}
    </motion.div>
  )
}

/** Stagger container — animates children (StaggerItem) on scroll into view. */
export function StaggerGroup({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : 'hidden'}
      whileInView={reduce ? undefined : 'show'}
      viewport={{ once: true, margin: '-48px' }}
      variants={stagger}
    >
      {children}
    </motion.div>
  )
}

/** Child of StaggerGroup — inherits the fade-up variant. */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  )
}

/** Centered section heading with emerald eyebrow. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  id,
  className,
}: {
  eyebrow: string
  title: string
  description?: string
  id?: string
  className?: string
}) {
  return (
    <Reveal className={cn('mx-auto max-w-2xl text-center', className)}>
      <p className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
        <span className="h-px w-6 bg-emerald-500/60" aria-hidden="true" />
        {eyebrow}
        <span className="h-px w-6 bg-emerald-500/60" aria-hidden="true" />
      </p>
      <h2
        id={id}
        className="mt-4 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
      ) : null}
    </Reveal>
  )
}

/** Animated number that counts up when scrolled into view. */
export function CountUp({
  to,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.7,
  className,
}: {
  to: number
  prefix?: string
  suffix?: string
  decimals?: number
  duration?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const reduce = useReducedMotion()

  const format = useCallback(
    (v: number) =>
      `${prefix}${v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`,
    [prefix, suffix, decimals]
  )

  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    if (reduce) {
      el.textContent = format(to)
      return
    }
    const controls = animate(0, to, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        el.textContent = format(v)
      },
    })
    return () => controls.stop()
  }, [inView, to, duration, reduce, format])

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  )
}

"use client"

import { motion, useInView } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { fadeUpVariants, defaultTransition } from '@/lib/motion'

interface FadeUpOnScrollProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function FadeUpOnScroll({ children, delay = 0, className }: FadeUpOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      variants={fadeUpVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ ...defaultTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

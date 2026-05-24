"use client"

import { motion, useInView } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { staggerContainer, fadeUpVariants, defaultTransition } from '@/lib/motion'

interface Props {
  children: ReactNode
  className?: string
}

export function FeatureCardsContainer({ children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

export function FeatureCardAnimated({ children, className }: Props) {
  return (
    <motion.div
      variants={fadeUpVariants}
      transition={defaultTransition}
      className={className}
    >
      {children}
    </motion.div>
  )
}

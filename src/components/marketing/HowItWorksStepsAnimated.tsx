"use client"

import { motion, useInView } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { slideInLeftVariants, staggerContainer, defaultTransition } from '@/lib/motion'

export function StepsContainer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLOListElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.ol
      ref={ref}
      className="flex flex-col gap-0"
      variants={staggerContainer}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.ol>
  )
}

export function StepItemAnimated({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.li
      variants={slideInLeftVariants}
      transition={defaultTransition}
      className={className}
    >
      {children}
    </motion.li>
  )
}

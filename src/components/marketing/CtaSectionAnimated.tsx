"use client"

import { motion, useInView } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { fadeUpVariants, defaultTransition } from '@/lib/motion'

export function CtaContentAnimated({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      className="max-w-3xl mx-auto flex flex-col items-center gap-6 text-center"
      variants={fadeUpVariants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ ...defaultTransition, duration: 0.6 }}
    >
      {children}
    </motion.div>
  )
}

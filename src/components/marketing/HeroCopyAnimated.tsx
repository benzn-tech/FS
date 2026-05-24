"use client"

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { staggerContainer, fadeUpVariants, defaultTransition } from '@/lib/motion'

export function HeroCopyAnimated({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex flex-col gap-6"
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function HeroCopyItem({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div variants={fadeUpVariants} transition={{ ...defaultTransition, delay }}>
      {children}
    </motion.div>
  )
}

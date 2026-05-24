"use client"

import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { floatVariants } from '@/lib/motion'

export function HeroMockupAnimated({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="hidden md:flex justify-center"
      initial="rest"
      animate="float"
      variants={floatVariants}
    >
      {children}
    </motion.div>
  )
}

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/20 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive/20 text-destructive',
        outline: 'border-border text-foreground',
        funding: 'bg-green-500/10 text-green-400 border-green-500/20',
        hire: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
        layoff: 'bg-red-500/10 text-red-400 border-red-500/20',
        launch: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        general: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

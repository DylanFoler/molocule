import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'
import type { SignalType } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy')
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  return `${format(new Date(start), 'MMM d')} to ${format(new Date(end), 'MMM d, yyyy')}`
}

export function signalTypeColor(type: SignalType): string {
  const colors: Record<SignalType, string> = {
    FUNDING: '#22C55E',
    KEY_HIRE: '#7C3AED',
    LAYOFF: '#EF4444',
    PRODUCT_LAUNCH: '#F59E0B',
    GENERAL: '#3B82F6',
  }
  return colors[type]
}

export function signalTypeBg(type: SignalType): string {
  const bgs: Record<SignalType, string> = {
    FUNDING: 'bg-green-500/10 text-green-400 border-green-500/20',
    KEY_HIRE: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    LAYOFF: 'bg-red-500/10 text-red-400 border-red-500/20',
    PRODUCT_LAUNCH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    GENERAL: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  }
  return bgs[type]
}

export function getFaviconUrl(website: string): string {
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`
  } catch {
    return ''
  }
}

export function getDomain(website: string): string {
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    return url.hostname.replace('www.', '')
  } catch {
    return website
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '…'
}

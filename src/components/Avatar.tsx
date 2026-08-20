import type { Person } from '../types'
import { avatarHue, initialsOf } from '../lib/occurrences'

interface AvatarProps {
  person: Person
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
} as const

export function Avatar({ person, size = 'md' }: AvatarProps) {
  const hue = avatarHue(person.id || person.name)

  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: `hsl(${hue} 58% 48%)` }}
    >
      {initialsOf(person.name)}
    </span>
  )
}

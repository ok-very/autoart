import { capitalize } from '@/lib/helpers'

interface CategoryBadgeProps {
  category: string
}

export function CategoryBadge({ category }: CategoryBadgeProps) {
  return <span class={`badge badge-${category}`}>{capitalize(category)}</span>
}

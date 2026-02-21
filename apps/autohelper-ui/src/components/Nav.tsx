interface NavProps {
  active: 'settings' | 'health' | 'recon' | 'directory'
}

const links = [
  { href: '/artists-settings', key: 'settings', label: 'Settings' },
  { href: '/artists-health', key: 'health', label: 'Health' },
  { href: '/artists-recon', key: 'recon', label: 'Reconciliation' },
  { href: '/artists-dashboard', key: 'directory', label: 'Directory' },
] as const

export function Nav({ active }: NavProps) {
  return (
    <nav class="artist-nav">
      {links.map(l => (
        <a
          key={l.key}
          href={l.href}
          class={`nav-link${l.key === active ? ' active' : ''}`}
        >
          {l.label}
        </a>
      ))}
    </nav>
  )
}

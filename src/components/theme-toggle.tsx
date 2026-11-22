import { useLayoutEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

type Theme = typeof options[number]['value']
const storageKey = 'finctl-theme'

function isTheme(value: string | null): value is Theme {
  return options.some((option) => option.value === value)
}

function initialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(storageKey)
    if (isTheme(saved)) return saved
  } catch {
    return 'dark'
  }
  return 'dark'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState(initialTheme)

  useLayoutEffect(() => {
    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    const themeColor = document.querySelector('meta[name="theme-color"]')

    function applyTheme() {
      const dark = theme === 'dark' || (theme === 'system' && preference.matches)
      document.documentElement.classList.toggle('dark', dark)
      themeColor?.setAttribute('content', dark ? '#0a0a0a' : '#ffffff')
    }

    applyTheme()
    if (theme !== 'system') return

    preference.addEventListener('change', applyTheme)
    return () => preference.removeEventListener('change', applyTheme)
  }, [theme])

  function changeTheme(value: string) {
    if (!isTheme(value)) return
    setTheme(value)
    try {
      window.localStorage.setItem(storageKey, value)
    } catch {
      return
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-11 sm:size-9" aria-label="Change theme">
          <Sun aria-hidden="true" className="size-4 transition-transform motion-reduce:transition-none dark:scale-0 dark:-rotate-90" />
          <Moon aria-hidden="true" className="absolute size-4 scale-0 rotate-90 transition-transform motion-reduce:transition-none dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={changeTheme}>
          {options.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="min-h-11 sm:min-h-0">
              <Icon aria-hidden="true" /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

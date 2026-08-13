import { useEffect, useState } from 'react'
import './index.css'
import Dashboard from './components/Dashboard'

function App() {
  const [themePreference, setThemePreference] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light'
    }
    return 'light'
  })
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const pref = localStorage.getItem('theme') || 'light'
      if (pref === 'system') {
        return 'dark'
      }
      return pref
    }
    return 'light'
  })

  useEffect(() => {
    const applyTheme = value => {
      if (value === 'system') {
        setTheme('dark')
      } else {
        setTheme(value)
      }
    }

    applyTheme(themePreference)
    localStorage.setItem('theme', themePreference)

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = event => {
      if (themePreference === 'system') {
        setTheme(event.matches ? 'dark' : 'light')
      }
    }
    mediaQuery.addEventListener?.('change', onChange)
    return () => mediaQuery.removeEventListener?.('change', onChange)
  }, [themePreference])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    if (themePreference === 'system') {
      document.documentElement.dataset.themeMode = 'system'
    } else {
      document.documentElement.removeAttribute('data-theme-mode')
    }
  }, [theme, themePreference])

  return (
    <Dashboard
      theme={theme}
      themePreference={themePreference}
      onThemeChange={value => setThemePreference(value)}
    />
  )
}

export default App

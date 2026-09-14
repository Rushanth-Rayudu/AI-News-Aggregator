import { useEffect, useState } from 'react'
import './index.css'
import Dashboard from './components/Dashboard'
import NotFound from './components/NotFound'
import Landing from './pages/Landing'
import Cursor from './components/Cursor'
import { usePath, navigate, ROUTES } from './utils/router'

const THEME_VALUES = ['sys', 'light', 'dark']
const THEME_COLORS = { sys: '#000000', light: '#f4f3ee', dark: '#0b0e13' }

const TITLES = {
  home: 'Home | AI News Aggregator',
  news: 'News | AI News Aggregator',
  notFound: 'Page not found | AI News Aggregator',
}

const DESCRIPTIONS = {
  notFound: 'This page is unavailable. Return to AI News Aggregator home or the live dashboard.',
  home: 'AI News Aggregator continuously monitors the most important AI sources — labs, research, publications, open source and infrastructure — and reduces them into one clustered, scored intelligence record.',
  news: 'Live intelligence record: clustered, scored and summarized developments from the sources that matter.',
}

/** Stored preference → active theme. Migrates the legacy 'system' value to 'sys'. */
function readStoredTheme() {
  if (typeof window === 'undefined') return 'light'
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'system') return 'sys'
    return THEME_VALUES.includes(stored) ? stored : 'light'
  } catch {
    return 'light'
  }
}

const ROUTE_KEYS = {
  [ROUTES.HOME]: 'home',
  [ROUTES.NEWS]: 'news',
}

/* Compatibility addresses → canonical routes. Root goes to /home; the legacy
   dashboard aliases go to /news. All use replace navigation (see App effect)
   so they never pollute browser history. /news is the ONE dashboard route. */
const REDIRECTS = {
  '/': ROUTES.HOME,
  [ROUTES.INTELLIGENCE]: ROUTES.NEWS,
  [ROUTES.INTELLIGENCE_DASHBOARD]: ROUTES.NEWS,
}

function routeMeta(path) {
  const key = ROUTE_KEYS[path]
  return key ? { key } : { key: 'notFound' }
}

function App() {
  const [theme, setTheme] = useState(readStoredTheme)
  const [sysBoot, setSysBoot] = useState(false)
  const path = usePath()
  const redirectTarget = REDIRECTS[path] || null

  useEffect(() => {
    if (redirectTarget) navigate(redirectTarget, { replace: true })
  }, [redirectTarget])

  const meta = routeMeta(redirectTarget || path)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.dark)
  }, [theme])

  useEffect(() => {
    document.title = TITLES[meta.key]
    let desc = document.querySelector('meta[name="description"]')
    if (!desc) {
      desc = document.createElement('meta')
      desc.setAttribute('name', 'description')
      document.head.appendChild(desc)
    }
    desc.setAttribute('content', DESCRIPTIONS[meta.key])
    for (const [property, content] of [['og:title', TITLES[meta.key]], ['og:description', DESCRIPTIONS[meta.key]]]) {
      let tag=document.querySelector('meta[property="'+property+'"]');
      if(!tag){tag=document.createElement('meta');tag.setAttribute('property',property);document.head.appendChild(tag);}
      tag.setAttribute('content',content);
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [meta.key])

  function changeTheme(value) {
    if (!THEME_VALUES.includes(value)) return
    const previous = theme
    setTheme(value)
    try {
      localStorage.setItem('theme', value)
    } catch {
      // storage unavailable — theme still applies for this session
    }
    // SYS activation moment: a brief brightness settle into phosphor.
    // Skipped for reduced-motion users (the CSS also neutralizes it).
    if (value === 'sys' && previous !== 'sys') {
      const reduced = typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!reduced) {
        setSysBoot(true)
        window.setTimeout(() => setSysBoot(false), 680)
      }
    }
  }

  return (
    <>
      {meta.key === 'news' ? (
        <Dashboard theme={theme} onThemeChange={changeTheme} />
      ) : meta.key === 'home' ? (
        <Landing theme={theme} onThemeChange={changeTheme} />
      ) : (
        <NotFound />
      )}
      {sysBoot && <div className="sys-boot" aria-hidden="true" />}
      <Cursor />
    </>
  )
}

export default App

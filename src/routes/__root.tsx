import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import appCss from '../styles.css?url'
import { SearchModal } from '@/components/search/search-modal'
import { TerminalShortcutListener } from '@/components/terminal-shortcut-listener'
import { GlobalShortcutListener } from '@/components/global-shortcut-listener'
import { WorkspaceShell } from '@/components/workspace-shell'
import { MobilePromptTrigger } from '@/components/mobile-prompt/MobilePromptTrigger'
import { Toaster } from '@/components/ui/toast'
import { OnboardingTour } from '@/components/onboarding/onboarding-tour'
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts-modal'
import { initializeSettingsAppearance } from '@/hooks/use-settings'
import { HermesOnboarding } from '@/components/onboarding/hermes-onboarding'

const APP_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' ws: wss: http: https:",
  "worker-src 'self' blob:",
  "media-src 'self' blob: data:",
  "frame-src 'self' http: https:",
].join('; ')

const THEME_STORAGE_KEY = 'hermes-theme'
const DEFAULT_THEME = 'hermes-official'
const VALID_THEMES = [
  'hermes-official',
  'hermes-official-light',
  'hermes-classic',
  'hermes-classic-light',
  'hermes-slate',
  'hermes-slate-light',
  'hermes-mono',
  'hermes-mono-light',
]

const themeScript = `
(() => {
  window.process = window.process || { env: {}, platform: 'browser' };

  try {
    const root = document.documentElement
    const storedTheme = localStorage.getItem('${THEME_STORAGE_KEY}')
    const theme = ${JSON.stringify(VALID_THEMES)}.includes(storedTheme) ? storedTheme : '${DEFAULT_THEME}'
    const lightThemes = ['hermes-official-light', 'hermes-classic-light', 'hermes-slate-light', 'hermes-mono-light']
    const isDark = !lightThemes.includes(theme)
    root.classList.remove('light', 'dark', 'system')
    root.classList.add(isDark ? 'dark' : 'light')
    root.setAttribute('data-theme', theme)
    root.style.setProperty('color-scheme', isDark ? 'dark' : 'light')

    // Demo mode
    try {
      if (new URLSearchParams(window.location.search).get('demo') === '1') {
        document.documentElement.setAttribute('data-demo', 'true');
      }
    } catch {}
  } catch {}
})()
`

const themeColorScript = `
(() => {
  try {
    const root = document.documentElement
    const theme = root.getAttribute('data-theme') || '${DEFAULT_THEME}'
    const colors = {
      'hermes-official': '#0A0E1A',
      'hermes-official-light': '#F6F8FC',
      'hermes-classic': '#0d0f12',
      'hermes-classic-light': '#F5F2ED',
      'hermes-slate': '#0d1117',
      'hermes-slate-light': '#F6F8FA',
      'hermes-mono': '#111111',
      'hermes-mono-light': '#FAFAFA',
    }
    const nextColor = colors[theme] || colors['${DEFAULT_THEME}']
    const isDark = !['hermes-official-light', 'hermes-classic-light', 'hermes-slate-light', 'hermes-mono-light'].includes(String(theme))

    let meta = document.querySelector('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'theme-color')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', nextColor)
    root.style.setProperty('color-scheme', isDark ? 'dark' : 'light')
  } catch {}
})()
`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-visual',
      },
      {
        title: 'Hermes Workspace',
      },
      {
        name: 'description',
        content:
          'Hermes Agent workspace for chat, tools, files, memory, and jobs.',
      },
      {
        property: 'og:image',
        content: '/cover.png',
      },
      {
        property: 'og:image:type',
        content: 'image/png',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:image',
        content: '/cover.png',
      },
      // PWA meta tags
      {
        name: 'theme-color',
        content: '#0A0E1A',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'default',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/png',
        href: '/hermes-avatar.png',
      },
      // PWA manifest and icons
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'apple-touch-icon',
        href: '/apple-touch-icon.png',
        sizes: '180x180',
      },
    ],
  }),

  shellComponent: RootDocument,
  component: RootLayout,
  errorComponent: function RootError({ error }) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-primary-50">
        <h1 className="text-2xl font-semibold text-primary-900 mb-4">
          Something went wrong
        </h1>
        <pre className="p-4 bg-primary-100 rounded-lg text-sm text-primary-700 max-w-full overflow-auto mb-6">
          {error instanceof Error ? error.message : String(error)}
        </pre>
        <button
          onClick={() => (window.location.href = '/')}
          className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors"
        >
          Return Home
        </button>
      </div>
    )
  },
})

const queryClient = new QueryClient()

function RootLayout() {
  // Unregister any existing service workers — they cause stale asset issues
  // after Docker image updates and behind reverse proxies (Pangolin, Cloudflare, etc.)
  useEffect(() => {
    initializeSettingsAppearance()

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister()
        }
      })
      // Also clear any stale caches
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name)
          }
        })
      }
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <HermesOnboarding />
      <GlobalShortcutListener />
      <TerminalShortcutListener />
      <MobilePromptTrigger />
      <Toaster />
      <WorkspaceShell />
      <SearchModal />
      <OnboardingTour />
      <KeyboardShortcutsModal />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme={DEFAULT_THEME} style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={APP_CSP} />
        <script dangerouslySetInnerHTML={{ __html: `
          // Polyfill crypto.randomUUID for non-secure contexts (HTTP access via LAN IP)
          if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
            crypto.randomUUID = function() {
              return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
                return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16);
              });
            };
          }
        ` }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeColorScript }} />
      </head>
      <body>
        {/* Splash screen rendered in SSR to avoid React hydration mismatch (#418).
            The script below updates colors for non-default themes via localStorage. */}
        <div id="splash-screen" suppressHydrationWarning style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: '#0A0E1A', transition: 'opacity 0.5s ease',
        }}>
          <img src="/hermes-avatar.webp" alt="Hermes" style={{
            width: 80, height: 80, marginBottom: 20, borderRadius: 16,
            filter: 'drop-shadow(0 8px 32px color-mix(in srgb, #6366F1 45%, transparent))',
          }} />
          <img src="/hermes-banner.png" alt="Hermes Workspace" id="splash-banner" style={{
            width: 280, height: 'auto', marginBottom: 8,
            filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
          }} />
          <div id="splash-subtitle" style={{
            font: '400 14px/1 system-ui,-apple-system,sans-serif',
            letterSpacing: '0.04em', color: '#9AA5BD',
          }}>Workspace</div>
          <div id="splash-track" style={{
            marginTop: 28, width: 140, height: 3,
            background: 'rgba(255,255,255,0.08)', borderRadius: 3,
            overflow: 'hidden', position: 'relative',
          }}>
            <div id="splash-bar" style={{
              width: '0%', height: '100%', background: '#6366F1',
              borderRadius: 3, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var bg = '#0A0E1A', muted = '#9AA5BD', accent = '#6366F1', isDark = true;
            try {
              var theme = localStorage.getItem('${THEME_STORAGE_KEY}') || '${DEFAULT_THEME}';
              var colors = {
                'hermes-classic':       { bg:'#0d0f12', muted:'#7f8a96', accent:'#b98a44' },
                'hermes-official-light': { bg:'#F6F8FC', muted:'#4B5563', accent:'#4F46E5' },
                'hermes-classic-light':  { bg:'#F5F2ED', muted:'#6F675E', accent:'#b98a44' },
                'hermes-slate':          { bg:'#0d1117', muted:'#8b949e', accent:'#7eb8f6' },
                'hermes-slate-light':    { bg:'#F6F8FA', muted:'#57606A', accent:'#3b82f6' },
                'hermes-mono':           { bg:'#111111', muted:'#888888', accent:'#aaaaaa' },
                'hermes-mono-light':     { bg:'#FAFAFA', muted:'#666666', accent:'#666666' },
              };
              if (colors[theme]) { bg = colors[theme].bg; muted = colors[theme].muted; accent = colors[theme].accent; }
              isDark = !['hermes-official-light','hermes-classic-light','hermes-slate-light','hermes-mono-light'].includes(theme);
            } catch(e){}

            // Update splash screen colors for non-default themes
            var el = document.getElementById('splash-screen');
            if (el) {
              el.style.background = bg;
              var banner = document.getElementById('splash-banner');
              if (banner) {
                banner.src = isDark ? '/hermes-banner.png' : '/hermes-banner-light.png';
                banner.style.filter = 'drop-shadow(0 4px 16px ' + (isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)') + ')';
              }
              var sub = document.getElementById('splash-subtitle');
              if (sub) sub.style.color = muted;
              var track = document.getElementById('splash-track');
              if (track) track.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
              var bar = document.getElementById('splash-bar');
              if (bar) {
                bar.style.background = accent;
                setTimeout(function(){ bar.style.width='15%' }, 300);
                setTimeout(function(){ bar.style.width='40%' }, 800);
                setTimeout(function(){ bar.style.width='65%' }, 1500);
                setTimeout(function(){ bar.style.width='85%' }, 2500);
                setTimeout(function(){ bar.style.width='92%' }, 3200);
              }
            }

            window.__dismissSplash = function() {
              var s = document.getElementById('splash-screen');
              if (!s) return;
              var b = document.getElementById('splash-bar');
              if (b) b.style.width = '100%';
              setTimeout(function(){
                s.style.opacity = '0';
                setTimeout(function(){ s.remove(); }, 500);
              }, 300);
            };
            setTimeout(function(){ window.__dismissSplash && window.__dismissSplash(); }, 5000);
            try {
              if (localStorage.getItem('hermes-hermes-url') || localStorage.getItem('hermes-url')) {
                setTimeout(function(){ window.__dismissSplash && window.__dismissSplash(); }, 600);
              }
            } catch(e) {}
          })()
        `}} />
        <div className="root">{children}</div>
        <Scripts />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var start = Date.now();
            function check() {
              var el = document.querySelector('nav, aside, .workspace-shell, [data-testid]');
              var elapsed = Date.now() - start;
              if (el && elapsed > 2500) { window.__dismissSplash && window.__dismissSplash(); }
              else { setTimeout(check, 200); }
            }
            setTimeout(check, 2500);
          })()
        `}} />
      </body>
    </html>
  )
}

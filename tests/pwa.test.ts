import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '@/app/manifest'

const ROOT = process.cwd()
const read = (file: string) => readFile(join(ROOT, file), 'utf8')

describe('the manifest', () => {
  it('is named for the product', () => {
    const m = manifest()
    expect(m.name).toBe('Vibrnd Feedback')
    expect(m.short_name).toBe('Feedback')
  })

  it('opens on the journey, never on the admin', () => {
    // An installed kiosk that launched into a login screen would be a support
    // call on the first reboot.
    expect(manifest().start_url).toBe('/')
  })

  it('locks portrait, because the kiosk cannot reflow', () => {
    // Everything is designed at 1080x1920 (§6). A rotation would not reflow, it
    // would clip — and the CONTINUE button is what gets clipped.
    expect(manifest().orientation).toBe('portrait')
  })

  it('asks for a screen with no browser chrome on it', () => {
    const m = manifest()
    expect(m.display).toBe('fullscreen')
    // And degrades through the chain rather than dropping to a tabbed window.
    expect(m.display_override?.[0]).toBe('fullscreen')
    expect(m.display_override).toContain('standalone')
  })

  it('splashes on the kiosk ground rather than white', () => {
    expect(manifest().background_color).toBe('#fbf6ec')
  })

  it('ships a separately-rendered maskable icon', () => {
    // Android crops the corners off a maskable icon. Relabelling the 'any' icon
    // would slice the wordmark, which is the whole content.
    const icons = manifest().icons ?? []
    const maskable = icons.find((icon) => icon.purpose === 'maskable')
    expect(maskable).toBeDefined()
    expect(maskable?.src).not.toBe(icons.find((i) => i.purpose === 'any')?.src)
  })
})

describe('the service worker cannot stale the things that must not go stale', () => {
  it('never caches the API', async () => {
    // §3's promise is that a manager changes a string and the kiosk shows it
    // without a redeploy. A cached API response makes that false.
    const sw = await read('public/sw.js')
    expect(sw).toMatch(/isNeverCacheable[\s\S]*?startsWith\('\/api\/'\)/)
  })

  it('never caches the admin', async () => {
    const sw = await read('public/sw.js')
    expect(sw).toMatch(/isNeverCacheable[\s\S]*?startsWith\('\/admin'\)/)
  })

  it('never caches an RSC payload', async () => {
    // The RSC payload for a page IS the page. Caching it stales the copy just
    // as surely as caching HTML, and it is the easy one to miss.
    const sw = await read('public/sw.js')
    expect(sw).toContain("searchParams.has('_rsc')")
  })

  it('never intercepts anything that changes state', async () => {
    // A replayed POST is a duplicate submission. submission_id would collapse
    // it, but that is a backstop and not a licence.
    const sw = await read('public/sw.js')
    expect(sw).toMatch(/request\.method !== 'GET'[\s\S]{0,40}return/)
  })

  it('leaves the print agent alone', async () => {
    // 127.0.0.1:9100 is not ours to intercept, and a photo must never touch a
    // cache — rule 2.
    const sw = await read('public/sw.js')
    expect(sw).toContain("url.port === '9100'")
  })

  it('serves documents network-first, not cache-first', async () => {
    // The kill switch (§8b) has to reach the kiosk within seconds. Cache-first
    // navigation would hold a camera open that a manager had just switched off.
    const sw = await read('public/sw.js')
    const nav = sw.slice(sw.indexOf("request.mode === 'navigate'"))
    const fetchAt = nav.indexOf('fetch(request)')
    const cacheAt = nav.indexOf('caches.match')
    expect(fetchAt).toBeGreaterThan(-1)
    expect(fetchAt, 'the network must be tried before the cache').toBeLessThan(cacheAt)
  })

  it('only treats content-addressed assets as cache-first', async () => {
    const sw = await read('public/sw.js')
    const fn = sw.slice(sw.indexOf('function isStaticAsset'), sw.indexOf('function isNeverCacheable'))
    for (const safe of ['/_next/static/', '/artwork/', '/brand/', '/icons/']) {
      expect(fn, `${safe} should be cache-first`).toContain(safe)
    }
    // Nothing that renders copy.
    expect(fn).not.toContain('.html')
  })
})

describe('registration', () => {
  it('happens on the kiosk and not in the admin', async () => {
    const kiosk = await read('app/(kiosk)/layout.tsx')
    expect(kiosk).toContain('<ServiceWorker />')

    const admin = await read('app/(admin)/admin/layout.tsx')
    expect(admin).not.toContain('ServiceWorker')
  })

  it('never surfaces a registration failure', async () => {
    // The worker is a convenience. A kiosk that cannot register one works
    // exactly as it did before, and a console error on a café wall helps nobody.
    const source = await read('components/kiosk/ServiceWorker.tsx')
    expect(source).toMatch(/\.catch\(\(\) => \{\}\)/)
  })
})

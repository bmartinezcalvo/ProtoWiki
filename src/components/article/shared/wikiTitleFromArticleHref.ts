/** Decode a MediaWiki page title from a `/wiki/…` path segment. */
function titleFromWikiPathSegment(segment: string): string | null {
  const trimmed = segment.trim()
  if (!trimmed.length) return null
  try {
    return decodeURIComponent(trimmed.replace(/_/g, ' '))
  } catch {
    return trimmed.replace(/_/g, ' ')
  }
}

/** REST / Parsoid bodies use `./Page_name` wikilinks relative to the current title. */
function titleFromParsoidRelativeHref(href: string): string | null {
  if (!href.startsWith('./')) return null
  const path = href.slice(2).split('#')[0]?.split('?')[0] ?? ''
  return titleFromWikiPathSegment(path)
}

/**
 * Resolve a wiki page title from an in-article anchor `href` for the given host
 * (e.g. `en.wikipedia.org`). Returns `null` when the link should use normal navigation.
 */
export function wikiTitleFromArticleHref(href: string, wikiHost: string): string | null {
  if (!href || href.startsWith('#')) return null

  const parsoidTitle = titleFromParsoidRelativeHref(href)
  if (parsoidTitle) return parsoidTitle

  let url: URL
  try {
    url = new URL(href, `https://${wikiHost}`)
  } catch {
    return null
  }

  const sameWiki = url.hostname === wikiHost
  const relativeWiki = href.startsWith('/wiki/') || href.startsWith('/w/index.php')
  if (!sameWiki && !relativeWiki) return null

  if (url.pathname.startsWith('/wiki/')) {
    const segment = url.pathname.slice('/wiki/'.length).split('/')[0] ?? ''
    return titleFromWikiPathSegment(segment)
  }

  if (url.pathname === '/w/index.php' || url.pathname.endsWith('/index.php')) {
    const action = url.searchParams.get('action')
    if (action === 'edit' || action === 'history') return null
    const title = url.searchParams.get('title')
    if (!title) return null
    return titleFromWikiPathSegment(title)
  }

  return null
}

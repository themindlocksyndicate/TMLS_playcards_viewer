export function byCardName(a, b) { return (a.card||'').localeCompare(b.card||'') }
export function uniq(arr) { return Array.from(new Set(arr)) }
export function normalize(str='') { return (str||'').toLowerCase() }
export function matchesQuery(card, q) {
  if (!q) return true
  const s = normalize(q)
  const hay = [card.card, card.subtitle, card.category, card.flavor, ...(card.hints||[]), ...(card.tags||[])]
    .map(normalize).join(' | ')
  return hay.includes(s) || s.split(' ').every(part => hay.includes(part))
}
export async function loadJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)
  return await res.json()
}
export function getQueryParam(name) {
  const url = new URL(window.location.href)
  return url.searchParams.get(name)
}
export function setQueryParam(name, value) {
  const url = new URL(window.location.href)
  if (value === null || value === undefined || value === '') url.searchParams.delete(name)
  else url.searchParams.set(name, value)
  history.replaceState(null, '', url.toString())
}

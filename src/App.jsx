import React, { useEffect, useMemo, useState } from 'react'
import { loadJSON, byCardName, uniq, matchesQuery, getQueryParam, setQueryParam } from './utils.js'
import CardCanvas from './CardCanvas.jsx'

const STORAGE_DECK = 'tmls-viewer:deck'

async function loadConfig() { return await loadJSON('./config.json') }

function useDeckConfig() {
  const [cfg, setCfg] = useState(null)
  const [deckId, setDeckId] = useState(null)

  useEffect(() => {
    (async () => {
      const c = await loadConfig()
      setCfg(c)
      const fromQuery = getQueryParam('deck')
      const fromStorage = localStorage.getItem(STORAGE_DECK)
      const def = c.defaultDeck || (c.decks && c.decks[0]?.id) || null
      const chosen = fromQuery || fromStorage || def
      setDeckId(chosen)
      if (chosen) localStorage.setItem(STORAGE_DECK, chosen)
    })()
  }, [])

  function chooseDeck(id) {
    setDeckId(id)
    localStorage.setItem(STORAGE_DECK, id)
    setQueryParam('deck', id)
  }

  const deck = useMemo(() => (!cfg || !deckId) ? null : (cfg.decks.find(d => d.id === deckId) || null), [cfg, deckId])
  return { cfg, deck, deckId, chooseDeck }
}

export default function App() {
  const { cfg, deck, deckId, chooseDeck } = useDeckConfig()
  const [cards, setCards] = useState([])
  const [index, setIndex] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [rarity, setRarity] = useState('all')
  const [color, setColor] = useState('all')

  const [showDraw, setShowDraw] = useState(false)
  const [drawn, setDrawn] = useState(null)
  const [playAnim, setPlayAnim] = useState(false)

  useEffect(() => {
    (async () => {
      if (!deck) return
      try {
        setLoading(true); setErr(null)
        const base = deck.base?.replace(/\/$/, '') || '.'
        const [idx, all] = await Promise.all([
          loadJSON(`${base}/datasets/index.json`),
          loadJSON(`${base}/datasets/cards.json`)
        ])
        setIndex(idx); setCards(all)
      } catch (e) {
        console.error(e); setErr(String(e)); setIndex([]); setCards([])
      } finally {
        setLoading(false)
      }
    })()
  }, [deckId])

  const categories = useMemo(() => ['all', ...index.map(c => c.category_slug)], [index])
  const rarityOptions = useMemo(() => ['all', ...uniq(cards.map(c => c.rarity).filter(Boolean))], [cards])
  const colorOptions = useMemo(() => ['all', ...uniq(cards.map(c => c.color).filter(Boolean))], [cards])

  const filtered = useMemo(() => {
    let list = cards
    if (category !== 'all') list = list.filter(c => c.category_slug === category)
    if (rarity !== 'all') list = list.filter(c => (c.rarity||'').toLowerCase() === rarity.toLowerCase())
    if (color !== 'all') list = list.filter(c => (c.color||'').toLowerCase() === color.toLowerCase())
    if (query.trim()) list = list.filter(c => matchesQuery(c, query.trim()))
    return list.sort(byCardName)
  }, [cards, category, rarity, color, query])

  function drawRandom() {
    if (!filtered.length) return
    const pick = filtered[Math.floor(Math.random()*filtered.length)]
    drawCard(pick)
  }
  function drawCard(card) {
    setDrawn(card)
    setShowDraw(true)
    setTimeout(()=> setPlayAnim(true), 50)
  }
  function closeDraw() { setShowDraw(false); setPlayAnim(false); setDrawn(null) }

  if (!cfg) return <div className="p-6">Loading config…</div>

  return (
    <div className="max-w-7xl mx-auto p-4">
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TMLS Card Deck</h1>
          <p className="text-sm text-neutral-400">Multi-deck viewer met draw-animatie (back → flip → front)</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="text-sm text-neutral-400">Deck:</label>
          <select value={deckId || ''} onChange={e => chooseDeck(e.target.value)}
            className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800">
            {(cfg.decks || []).map(d => (
              <option key={d.id} value={d.id}>{d.name || d.id}</option>
            ))}
          </select>
          <button onClick={drawRandom} className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white">Draw Random</button>
        </div>
      </header>

      {!!err && <div className="mb-3 p-3 rounded-xl bg-red-900/30 border border-red-800 text-red-200 text-sm">Error: {err}</div>}
      {loading ? (
        <div className="p-6 text-center">Loading deck…</div>
      ) : (
        <>
          <Toolbar
            query={query} setQuery={setQuery}
            categories={categories} category={category} setCategory={setCategory}
            rarityOptions={rarityOptions} rarity={rarity} setRarity={setRarity}
            colorOptions={colorOptions} color={color} setColor={setColor}
            total={filtered.length} />
          <Grid cards={filtered} onDraw={drawCard}/>
        </>
      )}

      {showDraw && (
        <Modal onClose={closeDraw}>
          <CardCanvas
            backUrl={cfg.templates?.backSvg || './templates/back.svg'}
            frontUrl={cfg.templates?.frontSvg || './templates/front.svg'}
            card={drawn}
            play={playAnim}
            onDone={()=>{}}
          />
          <div className="mt-4 text-center">
            <div className="text-lg font-semibold">{drawn?.card}</div>
            <div className="text-sm text-neutral-400">{drawn?.category}</div>
            <button onClick={closeDraw} className="mt-3 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700">Close</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Toolbar({ query, setQuery, categories, category, setCategory, rarityOptions, rarity, setRarity, colorOptions, color, setColor, total }) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search (name, hints, tags…)"
        className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 outline-none focus:border-neutral-600"
      />
      <select value={category} onChange={e=>setCategory(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800">
        {categories.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={rarity} onChange={e=>setRarity(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800">
        {rarityOptions.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <select value={color} onChange={e=>setColor(e.target.value)}
              className="px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800">
        {colorOptions.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <div className="text-sm text-neutral-400 sm:col-span-4">Showing {total} cards</div>
    </div>
  )
}

function Grid({ cards, onDraw }) {
  if (!cards.length) {
    return <div className="p-8 text-center text-neutral-400">No cards match your filters.</div>
  }
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {cards.map(card => (
        <div key={card.id}
             className="text-left rounded-2xl border border-neutral-800 bg-neutral-900 hover:border-neutral-700 hover:bg-neutral-800 transition p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-400">{card.category}</div>
          <div className="mt-1 text-lg font-semibold">{card.card}</div>
          {card.subtitle && <div className="text-sm text-neutral-300">{card.subtitle}</div>}
          <ul className="mt-3 text-sm list-disc list-inside space-y-1">
            {(card.hints||[]).slice(0,3).map((h,i)=>(<li key={i} className="text-neutral-300">{h}</li>))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button onClick={()=>onDraw(card)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm">Draw</button>
          </div>
        </div>
      ))}
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="w-full max-w-md" onClick={e=>e.stopPropagation()}>
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          {children}
        </div>
      </div>
    </div>
  )
}

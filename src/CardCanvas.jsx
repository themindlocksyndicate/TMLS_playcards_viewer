import React, { useEffect, useMemo, useState } from 'react'

async function loadText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}`)
  return await res.text()
}

function escapeXml(unsafe='') {
  return String(unsafe).replace(/[&<>"']/g, function (m) {
    switch (m) { case '&': return '&amp;'; case '<': return '&lt;'; case '>': return '&gt;'; case '"': return '&quot;'; case "'": return '&#39;'; default: return m }
  })
}

function fillPlaceholders(svg, card) {
  const hints = card.hints || []
  const rep = {
    '{{CARD}}': card.card || '',
    '{{CATEGORY}}': card.category || '',
    '{{SUBTITLE}}': card.subtitle || '',
    '{{HINT1}}': hints[0] || '',
    '{{HINT2}}': hints[1] || '',
    '{{HINT3}}': hints[2] || '',
    '{{FLAVOR}}': card.flavor || '',
    '{{RARITY}}': card.rarity || '',
    '{{COLOR}}': card.color || '',
    '{{SYMBOL}}': card.symbol || ''
  }
  let out = svg
  for (const [k,v] of Object.entries(rep)) out = out.split(k).join(escapeXml(v))
  return out
}

export default function CardCanvas({ backUrl, frontUrl, card, play, onDone }) {
  const [backSVG, setBackSVG] = useState(null)
  const [frontSVG, setFrontSVG] = useState(null)
  const [flipped, setFlipped] = useState(false)
  const [phase, setPhase] = useState('idle')

  useEffect(() => {
    (async () => {
      const [b, f] = await Promise.all([loadText(backUrl), loadText(frontUrl)])
      setBackSVG(b); setFrontSVG(f)
    })().catch(console.error)
  }, [backUrl, frontUrl])

  useEffect(() => {
    if (!play || !backSVG || !frontSVG) return
    setPhase('sliding')
    const t1 = setTimeout(() => {
      setFlipped(true)
      setPhase('flipping')
      const t2 = setTimeout(() => { setPhase('done'); onDone && onDone() }, 800)
      return () => clearTimeout(t2)
    }, 650)
    return () => clearTimeout(t1)
  }, [play, backSVG, frontSVG])

  const frontFilled = useMemo(() => frontSVG ? fillPlaceholders(frontSVG, card) : null, [frontSVG, card])

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className={`card-3d w-full aspect-[744/1039] ${phase==='sliding' ? 'slide-in' : ''}`}>
        <div className={`flip-scene w-full h-full ${flipped ? 'flipped' : ''}`}>
          <div className="face back bg-neutral-900 border border-neutral-800">
            <div className="svg-wrap" dangerouslySetInnerHTML={{__html: backSVG || ''}} />
          </div>
          <div className="face front bg-neutral-900 border border-neutral-800">
            <div className="svg-wrap" dangerouslySetInnerHTML={{__html: frontFilled || ''}} />
          </div>
        </div>
      </div>
    </div>
  )
}

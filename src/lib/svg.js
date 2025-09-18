import { XLINK_NS } from "../config.js";

/* text + attribute token replacement */
export function replaceTextTokens(svgRoot, map){
  const walker = svgRoot.ownerDocument.createTreeWalker(svgRoot, NodeFilter.SHOW_TEXT, null);
  const edits=[]; while(walker.nextNode()){ if(/\{\{[A-Z0-9_]+\}\}/.test(walker.currentNode.nodeValue)) edits.push(walker.currentNode); }
  for(const n of edits){ n.nodeValue = n.nodeValue.replace(/\{\{([A-Z0-9_]+)\}\}/g,(_,k)=>(k in map ? String(map[k]) : "")); }
  svgRoot.querySelectorAll("*").forEach(el=>{
    for(const attr of Array.from(el.attributes)){
      if(/\{\{[A-Z0-9_]+\}\}/.test(attr.value)){
        el.setAttribute(attr.name, attr.value.replace(/\{\{([A-Z0-9_]+)\}\}/g,(_,k)=>(k in map ? String(map[k]) : "")));
      }
    }
  });
}
export function stripUnfilledTokens(svgRoot){
  const xml = new XMLSerializer().serializeToString(svgRoot).replace(/\{\{[A-Z0-9_]+\}\}/g, "");
  const doc = new DOMParser().parseFromString(xml, "image/svg+xml");
  svgRoot.replaceWith(doc.documentElement);
}

export function getHref(el){
  let v = el.getAttribute("href");
  if(v) return v;
  v = el.getAttributeNS(XLINK_NS, "href");
  if(v) return v;
  v = el.getAttribute("xlink:href");
  return v || "";
}

export async function fetchText(url){ const r = await fetch(url, {cache:"no-store"}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }
export function stripXmlDoctype(txt){ return txt.replace(/<\?xml[\s\S]*?\?>/g,"").replace(/<!DOCTYPE[\s\S]*?>/g,""); }
export function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])) }
export function escapeAttr(s){ return (s||"").replace(/"/g,"&quot;").replace(/</g,"&lt;") }

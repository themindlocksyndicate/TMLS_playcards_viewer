import { TEMPLATE_BACK, TEMPLATE_FRONT } from "../config.js";
import { replaceTextTokens, stripUnfilledTokens, fetchText, getHref, stripXmlDoctype } from "../lib/svg.js";

export function buildCardShell(container){
  container.innerHTML = `
    <div class="card" id="card">
      <div class="card-inner" id="cardInner">
        <div class="face back"><img id="backImg" alt="Card back" src="${TEMPLATE_BACK}"></div>
        <div class="face front"><div id="frontSvgHolder"></div></div>
      </div>
    </div>`;
  return {
    card: container.querySelector("#card"),
    inner: container.querySelector("#cardInner"),
    frontHolder: container.querySelector("#frontSvgHolder")
  };
}

export function startSlideThenFlip(cardEl){
  cardEl.classList.remove("flipped");
  cardEl.classList.add("is-enter");
  void cardEl.offsetWidth;
  cardEl.classList.remove("is-enter");
  cardEl.classList.add("is-slide");
  const onEnd = (e)=>{
    if(e.propertyName!=="transform") return;
    cardEl.classList.remove("is-slide");
    cardEl.removeEventListener("transitionend", onEnd);
    setTimeout(()=> cardEl.classList.add("flipped"), 60);
  };
  cardEl.addEventListener("transitionend", onEnd);
}

export function renderFrontInline(frontHolder, svgNode){
  frontHolder.innerHTML = "";
  frontHolder.appendChild(svgNode);
}

export async function buildFrontSVGDom(cardOrPartial, symbolKey, hints){
  const raw = await fetchText(TEMPLATE_FRONT);
  const doc  = new DOMParser().parseFromString(raw, "image/svg+xml");
  let svg    = doc.documentElement;

  const card = cardOrPartial.CARD ? cardOrPartial : cardOrPartial || {};

  replaceTextTokens(svg, {
    CARD: (card.card || card.title || card.CARD || "Untitled"),
    CATEGORY: (card.category || card.CATEGORY || ""),
    SUBTITLE: (card.subtitle || card.SUBTITLE || ""),
    HINT1: hints[0] || card.HINT1 || "",
    HINT2: hints[1] || card.HINT2 || "",
    HINT3: hints[2] || card.HINT3 || "",
    HINT4: hints[3] || card.HINT4 || "",
    HINT5: hints[4] || card.HINT5 || "",
    SYMBOL: symbolKey || ""
  });

  await inlineSymbolImages(svg);
  stripUnfilledTokens(svg);
  return svg;
}

async function inlineSymbolImages(svgRoot){
  const imgs = Array.from(svgRoot.querySelectorAll("image"));
  for(const img of imgs){
    const href = getHref(img);
    if(!href || !/symbols\/.+\.svg(\?.*)?$/i.test(href)) continue;
    const absUrl = new URL(href, location.href).toString();

    try{
      const txt = await fetchText(absUrl);
      const parsed = new DOMParser().parseFromString(txt, "image/svg+xml");
      const symSvg = parsed.documentElement;
      if(symSvg.nodeName.toLowerCase() !== "svg") continue;

      const nested = svgRoot.ownerDocument.createElementNS("http://www.w3.org/2000/svg","svg");
      ["x","y","width","height","preserveAspectRatio"].forEach(a=>{
        if(img.hasAttribute(a)) nested.setAttribute(a, img.getAttribute(a));
      });
      const vb = symSvg.getAttribute("viewBox");
      if(vb) nested.setAttribute("viewBox", vb);

      const inner = stripXmlDoctype(new XMLSerializer().serializeToString(symSvg))
        .replace(/^<svg[^>]*>|<\/svg>$/g,"");
      const tmp = svgRoot.ownerDocument.createElementNS("http://www.w3.org/2000/svg","g");
      tmp.innerHTML = inner;
      Array.from(tmp.childNodes).forEach(n=> nested.appendChild(n));
      img.replaceWith(nested);
    }catch(_){}
  }
}

// /src/main-multi.js
import "./style.css";
import { ensureAuth } from "./lib/firebase.js";
import { createRoom, joinRoom, heartbeat, endRoom } from "./services/room.js";
import { mountChatPanel } from "./ui/chatPanel.js";
import { mountPlayerList } from "./ui/playerList.js";
import { mountCardTable } from "./ui/cardTable.js";

const params = new URLSearchParams(location.search);
const roomCode = params.get("room") || "demo";
const asHost = params.get("host") === "1";

const playersRoot = document.querySelector("#players");
const chatRoot = document.querySelector("#chat");
const tableRoot = document.querySelector("#table");
const roomLabel = document.querySelector("#roomCodeLabel");
const endBtn = document.querySelector("#endBtn");
const statusDot = document.querySelector("#statusDot");
const statusText = document.querySelector("#statusText");
const deckBtn = document.querySelector("#deckBtn");

function setStatus(ok, text) {
  statusDot?.classList?.remove("bg-zinc-600", "bg-green-400");
  statusDot?.classList?.add(ok ? "bg-green-400" : "bg-zinc-600");
  if (statusText) statusText.textContent = text || (ok ? "Connected" : "Idle");
}

let hbTimer = null;

(async () => {
  try {
    setStatus(false, "Auth…");
    const user = await ensureAuth();

    if (asHost) {
      setStatus(false, "Create room…");
      await createRoom({ roomCode, hypnotistUid: user.uid });
    }

    setStatus(false, "Join…");
    await joinRoom({
      roomCode,
      uid: user.uid,
      displayName: "Guest " + user.uid.slice(0, 4),
    });

    // presence heartbeat
    setStatus(true, "Connected");
    const tick = () =>
      heartbeat({ roomCode, uid: user.uid }).catch(() =>
        setStatus(false, "Reconnecting…")
      );
    tick();
    hbTimer = setInterval(tick, 20000);

    // mount UI
    if (roomLabel) roomLabel.textContent = roomCode;
    const unchat = mountChatPanel(chatRoot, { roomCode, uid: user.uid });
    const unplayers = mountPlayerList(playersRoot, { roomCode });
    const untable = mountCardTable(tableRoot, {
      roomCode,
      uid: user.uid,
      isHost: asHost,
    });

    endBtn?.addEventListener("click", async () => {
      try {
        await endRoom({ roomCode, uid: user.uid });
      } catch (e) {
        alert(e.message || String(e));
      }
    });

    deckBtn?.addEventListener("click", () => {
      alert("Deck selector coming soon");
    });

    window.addEventListener("beforeunload", () => {
      if (hbTimer) clearInterval(hbTimer);
      unchat?.();
      unplayers?.();
      untable?.();
    });
  } catch (err) {
    console.error(err);
    setStatus(false, "Error");
    alert(err?.message || String(err));
  }
})();

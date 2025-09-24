// src/ui/playerList.js
import { onParticipants } from "../services/room.js";

export function mountPlayerList(root, { roomCode }) {
  const box = root.querySelector("#playersScroll") || root;

  const unsub = onParticipants(roomCode, (rows) => {
    const now = Date.now();
    box.innerHTML = rows
      .map((p) => {
        const active = p.lastActiveAt?.toMillis
          ? now - p.lastActiveAt.toMillis() < 30000
          : false;
        return `
        <div class="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-black/20">
          <div class="w-2.5 h-2.5 rounded-full ${
            active ? "bg-green-400" : "bg-zinc-600"
          }"></div>
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">
              ${escapeHtml(p.displayName || "Player")}
              <span class="opacity-60 ml-1 text-[11px]">(${p.role})</span>
            </div>
            ${
              p.isTyping
                ? '<div class="text-[11px] italic opacity-60">typing…</div>'
                : ""
            }
          </div>
        </div>`;
      })
      .join("");
  });

  return () => unsub();

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[ch])
    );
  }
}

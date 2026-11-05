/* Fokus-Labor: Texte an Mama schicken (Kind) und Feedback anzeigen */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const list = a => Array.isArray(a) && a.length ? `<ul class="fbl">${a.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const LBL = { task: "Aufgabe", organisation: "Aufbau", vocabulary: "Wortschatz", grammar: "Grammatik" };

  /* Feedback schön darstellen (auch im Elternbereich benutzt) */
  window.renderFeedback = function (r, o) {
    o = o || {}; r = r || {};
    let h = "";
    if (o.note) h += `<div class="fbnote"><b>Nachricht von Mama</b><p>${esc(o.note)}</p></div>`;
    if (r.summary) h += `<p class="fbsum">${esc(r.summary)}</p>`;
    if (o.scores && r.scores) {
      const sum = Object.values(r.scores).reduce((a, b) => a + (+b || 0), 0);
      h += `<div class="fbscores">${Object.keys(LBL).map(k => `<span class="chip">${LBL[k]} ${esc(r.scores[k] ?? "–")}/5</span>`).join("")}<span class="chip mint">gesamt ${sum}/20</span></div>`;
    }
    if (r.praise && r.praise.length) h += `<h4>Das ist dir gut gelungen ⭐</h4>${list(r.praise)}`;
    if (r.fixes && r.fixes.length) h += `<h4>Das kannst du verbessern</h4><div class="list">${r.fixes.map(f => `<div class="li"><div class="txt"><span class="fbw">${esc(f.wrong)}</span> → <b class="fbr">${esc(f.right)}</b><small>${esc(f.why)}${f.type ? " · " + esc(f.type) : ""}</small></div></div>`).join("")}</div>`;
    if (r.content && r.content.length) h += `<h4>Zum Inhalt</h4>${list(r.content)}`;
    if (r.next && r.next.length) h += `<h4>So wird dein Text noch besser</h4>${list(r.next)}`;
    return h || `<p class="why">Kein Feedback.</p>`;
  };

  /* Kinderbereich */
  window.initTexts = function (sb, me, api) {
    const $ = id => document.getElementById(id);
    if (!$("txtBox")) return;
    const SEEN = "fokuslabor.textseen";
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(SEEN)) || {}; } catch (e) {}
    const count = () => { const n = ($("txtText").value.match(/[A-Za-zÄÖÜäöüß']+/g) || []).length; $("txtCount").textContent = n + " Wörter"; return n; };
    $("txtText").oninput = count;

    async function send(t) {
      const words = (t.text.match(/[A-Za-zÄÖÜäöüß']+/g) || []).length;
      const { error } = await sb.from("texts").insert({ family_id: me.family_id, fach: t.fach || "Englisch", art: t.art || "", angabe: t.angabe || "", text: t.text, words });
      if (error) { api.toast("Senden hat nicht geklappt. Internet prüfen."); return false; }
      api.toast("Text an Mama geschickt ✓"); api.gain(5, "Text abgegeben"); await load(); return true;
    }
    $("txtSend").onclick = async () => {
      const text = $("txtText").value.trim();
      if (count() < 20) { $("txtMsg").textContent = "Schreib mindestens 20 Wörter."; return; }
      $("txtSend").disabled = true;
      if (await send({ fach: $("txtFach").value.trim(), art: $("txtArt").value.trim(), angabe: $("txtAng").value.trim(), text })) {
        $("txtText").value = ""; $("txtAng").value = ""; $("txtMsg").textContent = ""; count();
      }
      $("txtSend").disabled = false;
    };

    async function load() {
      const { data, error } = await sb.from("texts").select("id,fach,art,angabe,text,words,status,review,note,show_scores,created_at,released_at").eq("family_id", me.family_id).order("created_at", { ascending: false }).limit(30);
      const el = $("txtList");
      if (error) { el.innerHTML = `<p class="why">Texte konnten nicht geladen werden. Internet prüfen.</p>`; return; }
      const fresh = (data || []).filter(t => t.status === "freigegeben" && !seen[t.id]).length;
      $("txtNew").hidden = !fresh; $("txtNew").textContent = fresh + " neu";
      el.innerHTML = (data || []).map(t => {
        const d = new Date(t.created_at).toLocaleDateString("de-AT", { day: "numeric", month: "numeric" });
        const rel = t.status === "freigegeben";
        return `<details class="nug" data-id="${t.id}" ${rel && !seen[t.id] ? "" : ""}><summary><span class="tt">${esc(t.art || t.fach)} · ${d}<small>${esc((t.angabe || "").slice(0, 70))}${t.words ? " · " + t.words + " Wörter" : ""}</small></span><span class="chip ${rel ? "mint" : "amber"}">${rel ? (seen[t.id] ? "Feedback ✓" : "Feedback da!") : "Mama schaut noch"}</span></summary>
          <div class="body">${rel ? window.renderFeedback(t.review, { note: t.note, scores: t.show_scores }) : ""}<details><summary class="why" style="cursor:pointer">Mein Text</summary><p style="white-space:pre-wrap;margin:8px 0 0">${esc(t.text)}</p></details></div></details>`;
      }).join("") || `<p class="why">Noch keine Texte. Schreib einen hier oder in der Englisch-Baustelle.</p>`;
      el.querySelectorAll("details.nug").forEach(d => d.addEventListener("toggle", () => {
        const t = (data || []).find(x => x.id === d.dataset.id);
        if (d.open && t && t.status === "freigegeben" && !seen[t.id]) {
          seen[t.id] = 1; try { localStorage.setItem(SEEN, JSON.stringify(seen)); } catch (e) {}
          api.gain(3, "Feedback gelesen");
        }
      }));
    }

    /* Text aus der Englisch-Baustelle übernehmen */
    let out = null; try { out = JSON.parse(localStorage.getItem("fokuslabor.outbox")); } catch (e) {}
    if (out && out.text) {
      try { localStorage.removeItem("fokuslabor.outbox"); } catch (e) {}
      send(out).then(ok => { if (!ok) { $("txtFach").value = out.fach || "Englisch"; $("txtArt").value = out.art || ""; $("txtAng").value = out.angabe || ""; $("txtText").value = out.text; count(); } });
    }
    if (location.hash === "#texte") { api.go("werkstatt"); setTimeout(() => $("txtBox").scrollIntoView({ block: "start" }), 50); try { history.replaceState(null, "", location.pathname); } catch (e) {} }
    load();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") load(); });
  };
})();

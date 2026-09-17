(() => {
  "use strict";

  const STORAGE_KEY = "prospects_v1";

  const STATUT_LABELS = {
    a_prospecter: "À prospecter",
    flyer_depose: "Flyer déposé",
    contact: "Contact établi",
    a_revisiter: "À revisiter",
    pas_interesse: "Pas intéressé",
  };
  const STATUT_COLORS = {
    a_prospecter: "#94a3b8",
    flyer_depose: "#2563eb",
    contact: "#16a34a",
    a_revisiter: "#f59e0b",
    pas_interesse: "#dc2626",
  };

  // ---------------------------------------------------------------
  // Stockage
  // ---------------------------------------------------------------
  function loadProspects() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Erreur de lecture des données", e);
      return [];
    }
  }
  function saveProspects() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prospects));
  }

  let prospects = loadProspects();

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function groupKey(p) {
    return `${(p.commune || "").trim().toLowerCase()}||${(p.quartier || "").trim().toLowerCase()}`;
  }

  function nextOrdre(commune, quartier) {
    const key = groupKey({ commune, quartier });
    const members = prospects.filter((p) => groupKey(p) === key);
    if (!members.length) return 0;
    return Math.max(...members.map((p) => p.ordre || 0)) + 1;
  }

  function naturalAddressCompare(a, b) {
    const parse = (addr) => {
      const m = /^(\d+)\s*(.*)$/.exec((addr || "").trim());
      if (m) return { num: parseInt(m[1], 10), street: m[2].toLowerCase() };
      return { num: Infinity, street: (addr || "").toLowerCase() };
    };
    const pa = parse(a.adresse);
    const pb = parse(b.adresse);
    if (pa.street !== pb.street) return pa.street.localeCompare(pb.street);
    return pa.num - pb.num;
  }

  // ---------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------
  function addProspect(data) {
    const p = {
      id: uid(),
      adresse: data.adresse.trim(),
      codePostal: (data.codePostal || "").trim(),
      commune: data.commune.trim(),
      quartier: (data.quartier || "").trim(),
      typeBien: data.typeBien || "",
      prix: data.prix || "",
      surface: data.surface || "",
      source: data.source || "",
      statut: data.statut || "a_prospecter",
      notes: data.notes || "",
      lat: null,
      lon: null,
      dateAjout: new Date().toISOString(),
      dateDepot: data.statut === "flyer_depose" ? new Date().toISOString() : null,
      ordre: nextOrdre(data.commune, data.quartier),
    };
    prospects.push(p);
    saveProspects();
    return p;
  }

  function updateProspect(id, changes) {
    const p = prospects.find((x) => x.id === id);
    if (!p) return;
    const wasDeposited = p.statut === "flyer_depose";
    Object.assign(p, changes);
    if (!wasDeposited && p.statut === "flyer_depose" && !p.dateDepot) {
      p.dateDepot = new Date().toISOString();
    }
    if (p.statut !== "flyer_depose") {
      // on garde la date même si le statut change ensuite, sauf remise à "à prospecter"
      if (p.statut === "a_prospecter") p.dateDepot = null;
    }
    saveProspects();
  }

  function deleteProspect(id) {
    prospects = prospects.filter((x) => x.id !== id);
    saveProspects();
  }

  function sortGroupAlpha(commune, quartier) {
    const key = groupKey({ commune, quartier });
    const members = prospects.filter((p) => groupKey(p) === key);
    members.sort(naturalAddressCompare);
    members.forEach((p, i) => (p.ordre = i));
    saveProspects();
  }

  function reorderGroup(commune, quartier, orderedIds) {
    const key = groupKey({ commune, quartier });
    orderedIds.forEach((id, i) => {
      const p = prospects.find((x) => x.id === id && groupKey(x) === key);
      if (p) p.ordre = i;
    });
    saveProspects();
  }

  // ---------------------------------------------------------------
  // Utilitaires UI
  // ---------------------------------------------------------------
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR");
  }

  function distinctSorted(arr) {
    return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function populateDropdowns() {
    const communes = distinctSorted(prospects.map((p) => p.commune));
    const quartiers = distinctSorted(prospects.map((p) => p.quartier));

    fillSelect(document.getElementById("filterCommune"), communes, "Toutes les communes");
    fillSelect(document.getElementById("filterQuartier"), quartiers, "Tous les quartiers");
    fillSelect(document.getElementById("mapFilterCommune"), communes, "Toutes les communes");
    fillSelect(document.getElementById("mapFilterQuartier"), quartiers, "Tous les quartiers");

    fillDatalist(document.getElementById("communeList"), communes);
    fillDatalist(document.getElementById("quartierList"), quartiers);
  }

  function fillSelect(select, values, placeholder) {
    const current = select.value;
    select.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = placeholder;
    select.appendChild(optAll);
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      select.appendChild(opt);
    });
    if (values.includes(current)) select.value = current;
  }

  function fillDatalist(datalist, values) {
    datalist.innerHTML = "";
    values.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      datalist.appendChild(opt);
    });
  }

  // ---------------------------------------------------------------
  // Filtrage
  // ---------------------------------------------------------------
  function getFilteredProspects({ communeSel, quartierSel, statutSel, searchSel } = {}) {
    const search = (document.getElementById(searchSel || "search")?.value || "").toLowerCase().trim();
    const commune = document.getElementById(communeSel || "filterCommune")?.value || "";
    const quartier = document.getElementById(quartierSel || "filterQuartier")?.value || "";
    const statut = document.getElementById(statutSel || "filterStatut")?.value || "";

    return prospects.filter((p) => {
      if (commune && p.commune !== commune) return false;
      if (quartier && p.quartier !== quartier) return false;
      if (statut && p.statut !== statut) return false;
      if (search) {
        const hay = `${p.adresse} ${p.notes} ${p.source} ${p.prix}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  // ---------------------------------------------------------------
  // Rendu : liste groupée
  // ---------------------------------------------------------------
  const collapsedGroups = new Set();

  function renderList() {
    const container = document.getElementById("listContainer");
    const grouped = document.getElementById("groupByQuartier").checked;
    const items = getFilteredProspects();

    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = `<p class="hint">Aucun prospect ne correspond aux filtres. Ajoutez-en un dans l'onglet "Ajouter".</p>`;
      return;
    }

    if (!grouped) {
      items.sort((a, b) => {
        if (a.commune !== b.commune) return a.commune.localeCompare(b.commune);
        if ((a.quartier || "") !== (b.quartier || "")) return (a.quartier || "").localeCompare(b.quartier || "");
        return (a.ordre || 0) - (b.ordre || 0);
      });
      const flatWrap = document.createElement("div");
      flatWrap.className = "group-block";
      const body = document.createElement("div");
      body.className = "group-body";
      items.forEach((p) => body.appendChild(renderRow(p, null)));
      flatWrap.appendChild(body);
      container.appendChild(flatWrap);
      return;
    }

    const groups = new Map();
    items.forEach((p) => {
      const key = groupKey(p);
      if (!groups.has(key)) groups.set(key, { commune: p.commune, quartier: p.quartier, items: [] });
      groups.get(key).items.push(p);
    });

    const sortedGroupKeys = [...groups.keys()].sort((ka, kb) => {
      const a = groups.get(ka), b = groups.get(kb);
      if (a.commune !== b.commune) return a.commune.localeCompare(b.commune);
      return (a.quartier || "").localeCompare(b.quartier || "");
    });

    sortedGroupKeys.forEach((key) => {
      const g = groups.get(key);
      g.items.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

      const block = document.createElement("div");
      block.className = "group-block";

      const total = g.items.length;
      const todo = g.items.filter((p) => p.statut === "a_prospecter" || p.statut === "a_revisiter").length;

      const header = document.createElement("div");
      header.className = "group-header";
      header.innerHTML = `
        <span>📍 ${escapeHtml(g.commune)}${g.quartier ? " — " + escapeHtml(g.quartier) : ""}
          <span class="count">(${total} prospect${total > 1 ? "s" : ""}, ${todo} à faire)</span>
        </span>
        <button class="small secondary sort-alpha-btn" type="button">🔤 Trier par rue</button>
      `;
      header.addEventListener("click", (e) => {
        if (e.target.closest(".sort-alpha-btn")) return;
        const body = block.querySelector(".group-body");
        body.classList.toggle("collapsed");
        if (body.classList.contains("collapsed")) collapsedGroups.add(key);
        else collapsedGroups.delete(key);
      });
      header.querySelector(".sort-alpha-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        sortGroupAlpha(g.commune, g.quartier);
        renderList();
        toast("Groupe trié par rue / numéro");
      });

      const body = document.createElement("div");
      body.className = "group-body";
      if (collapsedGroups.has(key)) body.classList.add("collapsed");

      g.items.forEach((p) => body.appendChild(renderRow(p, key)));
      enableDragSort(body, g.commune, g.quartier);

      block.appendChild(header);
      block.appendChild(body);
      container.appendChild(block);
    });
  }

  function renderRow(p, dragGroupKey) {
    const row = document.createElement("div");
    row.className = "prospect-row";
    row.dataset.id = p.id;
    if (dragGroupKey !== null) {
      row.draggable = true;
    }

    const sub = [p.codePostal, p.typeBien, p.prix, p.surface].filter(Boolean).join(" · ");
    const depotInfo = p.statut === "flyer_depose" && p.dateDepot ? ` · déposé le ${formatDate(p.dateDepot)}` : "";

    row.innerHTML = `
      ${dragGroupKey !== null ? '<span class="drag-handle" title="Glisser pour réordonner">⠿</span>' : ""}
      <span class="status-dot" style="background:${STATUT_COLORS[p.statut]}"></span>
      <div class="prospect-info">
        <div class="prospect-address">${escapeHtml(p.adresse)}</div>
        <div class="prospect-sub">${escapeHtml(sub)}${depotInfo ? escapeHtml(depotInfo) : ""}</div>
      </div>
      <span class="status-badge" style="background:${STATUT_COLORS[p.statut]}">${STATUT_LABELS[p.statut]}</span>
      <div class="row-actions">
        ${p.statut !== "flyer_depose" ? `<button class="small" data-action="depose">Flyer déposé ✓</button>` : ""}
        <button class="small secondary" data-action="edit">Modifier</button>
        <button class="small danger" data-action="delete">Suppr.</button>
      </div>
    `;

    row.querySelector('[data-action="depose"]')?.addEventListener("click", () => {
      updateProspect(p.id, { statut: "flyer_depose" });
      renderAll();
      toast("Marqué comme flyer déposé");
    });
    row.querySelector('[data-action="edit"]').addEventListener("click", () => openEdit(p.id));
    row.querySelector('[data-action="delete"]').addEventListener("click", () => {
      if (confirm(`Supprimer le prospect "${p.adresse}" ?`)) {
        deleteProspect(p.id);
        renderAll();
        toast("Prospect supprimé");
      }
    });

    return row;
  }

  function enableDragSort(container, commune, quartier) {
    let draggedId = null;
    container.querySelectorAll(".prospect-row").forEach((row) => {
      row.addEventListener("dragstart", () => {
        draggedId = row.dataset.id;
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        const after = getDragAfterElement(container, e.clientY);
        const dragging = container.querySelector(".dragging");
        if (!dragging) return;
        if (after == null) container.appendChild(dragging);
        else container.insertBefore(dragging, after);
      });
      row.addEventListener("drop", () => {
        const orderedIds = [...container.querySelectorAll(".prospect-row")].map((r) => r.dataset.id);
        reorderGroup(commune, quartier, orderedIds);
      });
    });
  }

  function getDragAfterElement(container, y) {
    const els = [...container.querySelectorAll(".prospect-row:not(.dragging)")];
    return els.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------------------------------------------------------------
  // Formulaire Ajout / Édition
  // ---------------------------------------------------------------
  function openEdit(id) {
    const p = prospects.find((x) => x.id === id);
    if (!p) return;
    document.getElementById("editId").value = p.id;
    document.getElementById("f_adresse").value = p.adresse;
    document.getElementById("f_codePostal").value = p.codePostal;
    document.getElementById("f_commune").value = p.commune;
    document.getElementById("f_quartier").value = p.quartier;
    document.getElementById("f_typeBien").value = p.typeBien;
    document.getElementById("f_prix").value = p.prix;
    document.getElementById("f_surface").value = p.surface;
    document.getElementById("f_source").value = p.source;
    document.getElementById("f_statut").value = p.statut;
    document.getElementById("f_notes").value = p.notes;
    document.getElementById("btnSubmit").textContent = "Enregistrer les modifications";
    document.getElementById("btnCancelEdit").style.display = "inline-block";
    switchTab("ajout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    document.getElementById("formAdd").reset();
    document.getElementById("editId").value = "";
    document.getElementById("btnSubmit").textContent = "Ajouter le prospect";
    document.getElementById("btnCancelEdit").style.display = "none";
  }

  function handleFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById("editId").value;
    const data = {
      adresse: document.getElementById("f_adresse").value,
      codePostal: document.getElementById("f_codePostal").value,
      commune: document.getElementById("f_commune").value,
      quartier: document.getElementById("f_quartier").value,
      typeBien: document.getElementById("f_typeBien").value,
      prix: document.getElementById("f_prix").value,
      surface: document.getElementById("f_surface").value,
      source: document.getElementById("f_source").value,
      statut: document.getElementById("f_statut").value,
      notes: document.getElementById("f_notes").value,
    };
    if (!data.adresse.trim() || !data.commune.trim()) {
      toast("Adresse et commune sont obligatoires");
      return;
    }
    if (id) {
      updateProspect(id, data);
      toast("Prospect modifié");
    } else {
      addProspect(data);
      toast("Prospect ajouté");
    }
    resetForm();
    renderAll();
    switchTab("liste");
  }

  function handleBulkAdd() {
    const commune = document.getElementById("bulk_commune").value.trim();
    const quartier = document.getElementById("bulk_quartier").value.trim();
    const raw = document.getElementById("bulk_addresses").value;
    if (!commune) {
      toast("Indiquez une commune pour l'ajout groupé");
      return;
    }
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) {
      toast("Collez au moins une adresse");
      return;
    }
    lines.forEach((adresse) => addProspect({ adresse, commune, quartier, statut: "a_prospecter" }));
    document.getElementById("bulk_addresses").value = "";
    renderAll();
    toast(`${lines.length} prospect(s) ajouté(s)`);
    switchTab("liste");
  }

  // ---------------------------------------------------------------
  // Export / Import
  // ---------------------------------------------------------------
  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlob(JSON.stringify(prospects, null, 2), `prospection-backup-${dateStr}.json`, "application/json");
  }

  function exportCsv() {
    const headers = ["adresse", "codePostal", "commune", "quartier", "typeBien", "prix", "surface", "source", "statut", "notes", "dateAjout", "dateDepot", "lat", "lon"];
    const rows = prospects.map((p) =>
      headers.map((h) => `"${String(p[h] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadBlob(csv, `prospection-${dateStr}.csv`, "text/csv;charset=utf-8");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("Format invalide");
        if (!confirm(`Remplacer toutes les données actuelles par les ${data.length} prospects de ce fichier ?`)) return;
        prospects = data;
        saveProspects();
        renderAll();
        toast("Import réussi");
      } catch (e) {
        alert("Fichier invalide : " + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ---------------------------------------------------------------
  // Carte
  // ---------------------------------------------------------------
  let map = null;
  let markersLayer = null;

  function initMap() {
    if (map) return;
    map = L.map("map").setView([46.6, 2.4], 6); // vue par défaut : France
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
  }

  function renderMap() {
    if (!map) return;
    markersLayer.clearLayers();

    const commune = document.getElementById("mapFilterCommune").value;
    const quartier = document.getElementById("mapFilterQuartier").value;

    const items = prospects.filter((p) => {
      if (commune && p.commune !== commune) return false;
      if (quartier && p.quartier !== quartier) return false;
      return p.lat != null && p.lon != null;
    });

    const bounds = [];
    items.forEach((p) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:50%;background:${STATUT_COLORS[p.statut]};border:2px solid #fff;box-shadow:0 0 2px rgba(0,0,0,.5)"></div>`,
        iconSize: [16, 16],
      });
      const marker = L.marker([p.lat, p.lon], { icon }).addTo(markersLayer);
      marker.bindPopup(`
        <strong>${escapeHtml(p.adresse)}</strong><br>
        ${escapeHtml(p.commune)}${p.quartier ? " — " + escapeHtml(p.quartier) : ""}<br>
        <span style="color:${STATUT_COLORS[p.statut]}">${STATUT_LABELS[p.statut]}</span>
        ${p.statut !== "flyer_depose" ? `<br><button class="small" id="popup-depose-${p.id}">Flyer déposé ✓</button>` : ""}
      `);
      marker.on("popupopen", () => {
        const btn = document.getElementById(`popup-depose-${p.id}`);
        if (btn) btn.addEventListener("click", () => {
          updateProspect(p.id, { statut: "flyer_depose" });
          renderAll();
          marker.closePopup();
        });
      });
      bounds.push([p.lat, p.lon]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }

  async function geocodeAddress(p) {
    const query = [p.adresse, p.codePostal, p.commune].filter(Boolean).join(", ");
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return false;
    const results = await res.json();
    if (!results.length) return false;
    p.lat = parseFloat(results[0].lat);
    p.lon = parseFloat(results[0].lon);
    return true;
  }

  async function geocodeAllMissing() {
    const statusEl = document.getElementById("geocodeStatus");
    const missing = prospects.filter((p) => p.lat == null || p.lon == null);
    if (!missing.length) {
      statusEl.textContent = "Toutes les adresses sont déjà géolocalisées.";
      return;
    }
    let done = 0, failed = 0;
    for (const p of missing) {
      statusEl.textContent = `Géolocalisation en cours... ${done + 1}/${missing.length}`;
      try {
        const ok = await geocodeAddress(p);
        if (!ok) failed++;
      } catch (e) {
        failed++;
      }
      done++;
      saveProspects();
      // Respect de la politique d'usage de Nominatim (max ~1 req/s)
      await new Promise((r) => setTimeout(r, 1100));
    }
    statusEl.textContent = `Terminé : ${done - failed}/${missing.length} géolocalisées${failed ? `, ${failed} introuvable(s) à vérifier manuellement` : ""}.`;
    renderMap();
  }

  // ---------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------
  function renderStats() {
    const container = document.getElementById("statsContainer");
    container.innerHTML = "";

    const total = prospects.length;
    const byStatut = {};
    Object.keys(STATUT_LABELS).forEach((k) => (byStatut[k] = 0));
    prospects.forEach((p) => (byStatut[p.statut] = (byStatut[p.statut] || 0) + 1));

    const cardStatut = document.createElement("div");
    cardStatut.className = "stat-card";
    cardStatut.innerHTML = `<h3>Répartition par statut (${total} prospects au total)</h3>`;
    Object.entries(byStatut).forEach(([k, v]) => {
      const pct = total ? Math.round((v / total) * 100) : 0;
      cardStatut.innerHTML += `
        <div class="stat-bar-row">
          <span style="min-width:130px">${STATUT_LABELS[k]}</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${STATUT_COLORS[k]}"></div></div>
          <span>${v} (${pct}%)</span>
        </div>`;
    });
    container.appendChild(cardStatut);

    const byCommune = {};
    prospects.forEach((p) => {
      byCommune[p.commune] = byCommune[p.commune] || { total: 0, depose: 0 };
      byCommune[p.commune].total++;
      if (p.statut === "flyer_depose" || p.statut === "contact") byCommune[p.commune].depose++;
    });
    const cardCommune = document.createElement("div");
    cardCommune.className = "stat-card";
    cardCommune.innerHTML = `<h3>Avancement par commune</h3>`;
    Object.entries(byCommune)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([commune, s]) => {
        const pct = s.total ? Math.round((s.depose / s.total) * 100) : 0;
        cardCommune.innerHTML += `
          <div class="stat-bar-row">
            <span style="min-width:130px">${escapeHtml(commune)}</span>
            <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:var(--primary)"></div></div>
            <span>${s.depose}/${s.total} traités</span>
          </div>`;
      });
    if (!Object.keys(byCommune).length) cardCommune.innerHTML += `<p class="hint">Aucune donnée pour l'instant.</p>`;
    container.appendChild(cardCommune);
  }

  // ---------------------------------------------------------------
  // Onglets
  // ---------------------------------------------------------------
  function switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tab}`));
    if (tab === "carte") {
      initMap();
      setTimeout(() => {
        map.invalidateSize();
        renderMap();
      }, 50);
    }
    if (tab === "stats") renderStats();
  }

  function renderAll() {
    populateDropdowns();
    renderList();
    if (map) renderMap();
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.getElementById("formAdd").addEventListener("submit", handleFormSubmit);
    document.getElementById("btnCancelEdit").addEventListener("click", () => {
      resetForm();
      switchTab("liste");
    });
    document.getElementById("btnBulkAdd").addEventListener("click", handleBulkAdd);

    ["search", "filterCommune", "filterQuartier", "filterStatut", "groupByQuartier"].forEach((id) => {
      document.getElementById(id).addEventListener("input", renderList);
      document.getElementById(id).addEventListener("change", renderList);
    });

    ["mapFilterCommune", "mapFilterQuartier"].forEach((id) => {
      document.getElementById(id).addEventListener("change", renderMap);
    });

    document.getElementById("btnPrint").addEventListener("click", () => window.print());
    document.getElementById("btnGeocodeAll").addEventListener("click", geocodeAllMissing);
    document.getElementById("btnExport").addEventListener("click", exportJson);
    document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
    document.getElementById("fileImport").addEventListener("change", (e) => {
      if (e.target.files[0]) importJson(e.target.files[0]);
      e.target.value = "";
    });

    renderAll();
  });
})();

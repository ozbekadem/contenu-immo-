/* =========================================================
   Immo Vision — scripts du site
   ========================================================= */
(function () {
  "use strict";

  var EMAIL_AGENCE = "info@immobiliervision.be";

  /* ---------- Menu mobile ---------- */
  var burger = document.querySelector(".burger");
  var nav = document.querySelector(".nav");
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var ouvert = burger.getAttribute("aria-expanded") === "true";
      var bas = document.querySelector(".entete").getBoundingClientRect().bottom;
      nav.style.top = Math.max(bas, 0) + "px";
      burger.setAttribute("aria-expanded", String(!ouvert));
      nav.classList.toggle("ouvert", !ouvert);
      document.body.style.overflow = ouvert ? "" : "hidden";
    });
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        burger.setAttribute("aria-expanded", "false");
        nav.classList.remove("ouvert");
        document.body.style.overflow = "";
      });
    });
  }

  /* ---------- Ombre de l'en-tête au défilement ---------- */
  var entete = document.querySelector(".entete");
  if (entete) {
    var majOmbre = function () { entete.classList.toggle("defile", window.scrollY > 10); };
    window.addEventListener("scroll", majOmbre, { passive: true });
    majOmbre();
  }

  /* ---------- Apparition au défilement ---------- */
  var aReveler = document.querySelectorAll(".revele");
  if ("IntersectionObserver" in window) {
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    aReveler.forEach(function (el) { obs.observe(el); });
  } else {
    aReveler.forEach(function (el) { el.classList.add("visible"); });
  }

  /* ---------- Compteurs ---------- */
  document.querySelectorAll("[data-compteur]").forEach(function (el) {
    var cible = parseFloat(el.getAttribute("data-compteur"));
    var decimales = (el.getAttribute("data-compteur").split(".")[1] || "").length;
    var suffixe = el.getAttribute("data-suffixe") || "";
    var lance = false;
    var lancer = function () {
      if (lance) return; lance = true;
      var debut = null, duree = 1400;
      var pas = function (t) {
        if (!debut) debut = t;
        var p = Math.min((t - debut) / duree, 1);
        el.textContent = (cible * (1 - Math.pow(1 - p, 3))).toFixed(decimales).replace(".", ",") + suffixe;
        if (p < 1) requestAnimationFrame(pas);
      };
      requestAnimationFrame(pas);
    };
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e, o) { if (e[0].isIntersecting) { lancer(); o.disconnect(); } }).observe(el);
    } else { lancer(); }
  });

  /* ---------- Icônes ---------- */
  var ICO = {
    lieu: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    lit: '<svg viewBox="0 0 24 24"><path d="M7 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9a4 4 0 0 0-4-4z"/></svg>',
    bain: '<svg viewBox="0 0 24 24"><path d="M7 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm13 6V4.83A2.83 2.83 0 0 0 15.17 2.8l-1.25 1.25A3 3 0 0 0 11 6c-.4 0-.78.08-1.13.22l2.6 2.6A3 3 0 0 0 12.72 6.7l1.25-1.25A.83.83 0 0 1 18 4.83V13H2v2a6 6 0 0 0 3 5.19V22h2v-1h10v1h2v-1.81A6 6 0 0 0 22 15v-2h-2z"/></svg>',
    surface: '<svg viewBox="0 0 24 24"><path d="M3 3h8v2H5v6H3V3zm18 0v8h-2V5h-6V3h8zM3 21v-8h2v6h6v2H3zm18 0h-8v-2h6v-6h2v8z"/></svg>',
    peb: '<svg viewBox="0 0 24 24"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>'
  };

  function formatPrix(bien) {
    if (bien.prix == null) return "Prix sur demande";
    var p = bien.prix.toLocaleString("fr-BE") + " €";
    return bien.transaction === "location" ? p + " / mois" : p;
  }

  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function carteBien(b) {
    var carac = [];
    if (b.chambres != null) carac.push('<span>' + ICO.lit + b.chambres + ' ch.</span>');
    if (b.sdb != null) carac.push('<span>' + ICO.bain + b.sdb + ' sdb</span>');
    if (b.surface != null) carac.push('<span>' + ICO.surface + b.surface + ' m²</span>');
    if (b.peb) carac.push('<span>' + ICO.peb + 'PEB ' + echapper(b.peb) + '</span>');
    if (!carac.length) carac.push('<span>' + echapper(b.type) + '</span><span class="lien-fleche">Voir le bien</span>');

    return '' +
      '<article class="carte-bien revele visible">' +
        '<a href="' + echapper(b.lien) + '" class="carte-image" aria-label="' + echapper(b.titre) + '">' +
          '<img src="' + echapper(b.image) + '" alt="' + echapper(b.titre) + '" loading="lazy" width="600" height="450">' +
          '<span class="badge' + (b.transaction === "location" ? " noir" : "") + '">' + (b.transaction === "location" ? "À louer" : "À vendre") + '</span>' +
          (b.statut ? '<span class="badge badge-statut">' + echapper(b.statut) + '</span>' : '') +
          '<span class="carte-prix">' + formatPrix(b) + '</span>' +
        '</a>' +
        '<div class="carte-corps">' +
          '<h3><a href="' + echapper(b.lien) + '">' + echapper(b.titre) + '</a></h3>' +
          '<p class="carte-lieu">' + ICO.lieu + echapper(b.commune) + '</p>' +
        '</div>' +
        '<div class="carte-carac">' + carac.join("") + '</div>' +
      '</article>';
  }

  /* ---------- Affichage des biens ---------- */
  var listeBiens = window.BIENS || [];
  var params = new URLSearchParams(window.location.search);

  document.querySelectorAll("[data-biens]").forEach(function (grille) {
    var transaction = grille.getAttribute("data-biens");   // "vente", "location" ou "tous"
    var limite = parseInt(grille.getAttribute("data-limite") || "0", 10);
    var formFiltres = document.querySelector(".filtres");
    var info = document.querySelector(".resultats-info");

    function afficher() {
      var f = formFiltres ? new FormData(formFiltres) : null;
      var type = f ? f.get("type") : params.get("type");
      var commune = ((f ? f.get("commune") : params.get("commune")) || "").toLowerCase().trim();
      var prixMax = parseInt((f ? f.get("prix") : params.get("prix")) || "0", 10);
      var chambres = parseInt((f ? f.get("chambres") : params.get("chambres")) || "0", 10);

      var res = listeBiens.filter(function (b) {
        if (transaction !== "tous" && b.transaction !== transaction) return false;
        if (type && b.type !== type) return false;
        if (commune && (b.commune + " " + b.titre).toLowerCase().indexOf(commune) === -1) return false;
        if (prixMax && b.prix != null && b.prix > prixMax) return false;
        if (chambres && b.chambres != null && b.chambres < chambres) return false;
        return true;
      });
      if (limite) res = res.slice(0, limite);

      grille.innerHTML = res.length
        ? res.map(carteBien).join("")
        : '<div class="vide"><p><strong>Aucun bien ne correspond à votre recherche pour le moment.</strong></p>' +
          '<p>Laissez-nous vos critères : nous vous prévenons dès qu\'un bien correspondant arrive.</p>' +
          '<a class="btn btn-jaune" href="contact.html?sujet=recherche">Être averti</a></div>';
      if (info) info.innerHTML = "<strong>" + res.length + "</strong> bien" + (res.length > 1 ? "s" : "") + " disponible" + (res.length > 1 ? "s" : "");
    }

    if (formFiltres) {
      // Pré-remplir avec les paramètres de l'URL (recherche depuis l'accueil)
      ["type", "commune", "prix", "chambres"].forEach(function (k) {
        var champ = formFiltres.elements[k];
        if (champ && params.get(k)) champ.value = params.get(k);
      });
      formFiltres.addEventListener("submit", function (e) { e.preventDefault(); afficher(); });
      formFiltres.addEventListener("change", afficher);
    }
    afficher();
  });

  /* ---------- Onglets de recherche (accueil) ---------- */
  var formRecherche = document.querySelector(".recherche form");
  document.querySelectorAll(".recherche-onglets button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".recherche-onglets button").forEach(function (b) { b.setAttribute("aria-selected", "false"); });
      btn.setAttribute("aria-selected", "true");
      if (formRecherche) formRecherche.setAttribute("action", btn.getAttribute("data-action"));
    });
  });

  /* ---------- Formulaires (contact / estimation) ---------- */
  var sujet = params.get("sujet");
  var bienDemande = params.get("bien");
  document.querySelectorAll("form[data-formulaire]").forEach(function (form) {
    var selSujet = form.elements["sujet"];
    if (selSujet && sujet) selSujet.value = sujet;
    var msg = form.elements["message"];
    if (msg && bienDemande && !msg.value) {
      var b = listeBiens.filter(function (x) { return x.id === bienDemande; })[0];
      msg.value = "Bonjour, je souhaite plus d'informations sur le bien " + (b ? "« " + b.titre + " » " : "") + "(réf. " + bienDemande + ").";
    }

    form.addEventListener("submit", function (e) {
      var retour = form.querySelector(".message-form");
      if (!form.checkValidity()) {
        e.preventDefault();
        form.reportValidity();
        return;
      }
      // Si une adresse d'envoi (Formspree, Netlify, PHP…) est configurée dans
      // l'attribut action, le formulaire est envoyé normalement.
      if (form.getAttribute("action")) return;

      // Sinon : ouverture du logiciel de messagerie avec le contenu pré-rempli.
      e.preventDefault();
      var donnees = new FormData(form);
      var lignes = [];
      donnees.forEach(function (v, k) { if (k !== "rgpd" && v) lignes.push(k.charAt(0).toUpperCase() + k.slice(1) + " : " + v); });
      var objet = form.getAttribute("data-formulaire") === "estimation" ? "Demande d'estimation gratuite" : "Demande de contact — site internet";
      window.location.href = "mailto:" + EMAIL_AGENCE + "?subject=" + encodeURIComponent(objet) + "&body=" + encodeURIComponent(lignes.join("\n"));
      if (retour) {
        retour.className = "message-form ok";
        retour.textContent = "Merci ! Votre logiciel de messagerie va s'ouvrir pour envoyer votre demande. Nous vous répondons sous 24 h.";
      }
    });
  });

  /* ---------- Bannière cookies ---------- */
  var banniere = document.querySelector(".cookies");
  var lireChoix = function () { try { return localStorage.getItem("iv-cookies"); } catch (e) { return null; } };
  var ecrireChoix = function (v) { try { localStorage.setItem("iv-cookies", v); } catch (e) { /* ignoré */ } };
  if (banniere && !lireChoix()) {
    banniere.classList.add("visible");
    banniere.querySelectorAll("[data-cookies]").forEach(function (b) {
      b.addEventListener("click", function () { ecrireChoix(b.getAttribute("data-cookies")); banniere.classList.remove("visible"); });
    });
  }

  /* ---------- Année du pied de page ---------- */
  document.querySelectorAll("[data-annee]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

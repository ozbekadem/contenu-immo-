"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import type { Project } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then((r) => setProjects(r.projects)).catch(() => setProjects([]));
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { project } = await api.createProject({ name, address, propertyType, reference });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-10">
      <div className="mb-10">
        <h1 className="text-3xl font-black tracking-tight text-studio-black sm:text-4xl">
          STUDIO PHOTO IMMOBILIER <span className="text-studio-yellow-deep">IA</span>
        </h1>
        <p className="mt-2 max-w-xl text-studio-gray-800/70">
          Améliorez jusqu&apos;à 10 photos immobilières simultanément — rapide, réaliste, cohérent, simple.
        </p>
      </div>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-studio-gray-800/60">Projets</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full bg-studio-yellow px-5 py-2.5 text-sm font-bold text-studio-black shadow-sm transition hover:bg-studio-yellow-deep"
        >
          + NOUVEAU PROJET
        </button>
      </div>

      {showForm && (
        <form onSubmit={createProject} className="mb-10 grid gap-3 rounded-2xl border border-studio-gray-200 bg-white p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-studio-gray-800/60">Nom du bien *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maison — Charleroi"
              className="w-full rounded-lg border border-studio-gray-200 px-3 py-2 text-sm outline-none focus:border-studio-yellow-deep"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-studio-gray-800/60">Adresse</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-studio-gray-200 px-3 py-2 text-sm outline-none focus:border-studio-yellow-deep"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-studio-gray-800/60">Type de bien</label>
            <input
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              placeholder="Maison, appartement..."
              className="w-full rounded-lg border border-studio-gray-200 px-3 py-2 text-sm outline-none focus:border-studio-yellow-deep"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-studio-gray-800/60">Référence interne</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-lg border border-studio-gray-200 px-3 py-2 text-sm outline-none focus:border-studio-yellow-deep"
            />
          </div>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <button
              disabled={creating || !name.trim()}
              className="rounded-full bg-studio-black px-6 py-2.5 text-sm font-bold text-studio-white disabled:opacity-40"
            >
              {creating ? "Création..." : "Créer le projet"}
            </button>
          </div>
        </form>
      )}

      {projects === null ? (
        <p className="text-studio-gray-800/50">Chargement…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-studio-gray-200 bg-white p-16 text-center text-studio-gray-800/60">
          Aucun projet pour l&apos;instant. Créez votre premier projet pour importer vos photos.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((p) => (
            <a
              key={p.id}
              href={`/projects/${p.id}`}
              className="group overflow-hidden rounded-2xl border border-studio-gray-200 bg-white transition hover:border-studio-yellow-deep hover:shadow-md"
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-studio-gray-100 overflow-hidden">
                {p.coverPhotoId && p.photos.find((ph) => ph.id === p.coverPhotoId) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/files/${p.photos.find((ph) => ph.id === p.coverPhotoId)!.currentFile}`}
                    alt={p.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <span className="text-4xl">🏠</span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-semibold text-studio-black">{p.name}</p>
                <p className="truncate text-xs text-studio-gray-800/50">{p.address || "—"}</p>
                <p className="mt-1 text-xs font-medium text-studio-gray-800/40">{p.photos.length} photo{p.photos.length > 1 ? "s" : ""}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

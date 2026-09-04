import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { listProjects, writeProject } from "@/lib/storage";
import type { Project, ProjectSettings } from "@/lib/types";

const DEFAULT_SETTINGS: ProjectSettings = {
  intensity: 50,
  hdrMode: "immobilier",
  lightAuto: "moyenne",
  colorStyle: "naturel",
  harmonizeLot: true,
  fidelityMode: "strict",
  appMode: "simple",
};

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name as string)?.trim();
  if (!name) return NextResponse.json({ error: "Le nom du bien est requis." }, { status: 400 });

  const now = new Date().toISOString();
  const project: Project = {
    id: randomUUID(),
    name,
    address: body.address || undefined,
    propertyType: body.propertyType || undefined,
    reference: body.reference || undefined,
    date: body.date || undefined,
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS },
    photos: [],
  };
  await writeProject(project);
  return NextResponse.json({ project }, { status: 201 });
}

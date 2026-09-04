// Shared domain types for the real-estate photo studio.

export type SceneType =
  | "salon"
  | "salle_a_manger"
  | "cuisine"
  | "chambre"
  | "salle_de_bains"
  | "wc"
  | "hall"
  | "garage"
  | "cave"
  | "grenier"
  | "commerce"
  | "bureau"
  | "facade"
  | "jardin"
  | "terrasse"
  | "autre";

export type Environment = "interieur" | "exterieur";

export type ExposureState = "sous-expose" | "correct" | "surexpose";

export type WhiteBalanceCast = "neutre" | "jaune" | "orange" | "bleu" | "vert" | "rouge";

export interface PhotoAnalysis {
  environment: Environment;
  scene: SceneType;
  channelMeans: [number, number, number]; // 0-255 mean R,G,B (gray-world input)
  brightness: number; // 0-1
  exposure: ExposureState;
  sharpness: number; // 0-1 (relative, higher = sharper)
  isBlurry: boolean;
  noise: number; // 0-1
  contrast: number; // 0-1
  whiteBalanceCast: WhiteBalanceCast;
  verticalTiltDeg: number;
  wideAngleDistortion: "faible" | "moyen" | "fort";
  skyFraction: number; // 0-1 fraction of frame classified as sky
  skyQuality: number; // 0-1
  windowOverexposure: number; // 0-1 fraction of blown highlights
  qualityScore: number; // 0-100 composite
  flags: string[];
  duplicateOf?: string;
  phash?: string;
}

export type HistoryStepKind =
  | "original"
  | "retouche_pro"
  | "hdr"
  | "luminosite"
  | "balance_blancs"
  | "perspective"
  | "grand_angle"
  | "nettete"
  | "debruitage"
  | "ciel"
  | "cadrage"
  | "contour"
  | "suppression_objet"
  | "ajout_objet"
  | "desencombrement"
  | "virtual_staging"
  | "instruction"
  | "preset"
  | "custom";

export interface HistoryStep {
  id: string;
  kind: HistoryStepKind;
  label: string;
  file: string; // relative path under storage/
  category: "retouche" | "modification_ia";
  createdAt: string;
  params?: Record<string, unknown>;
}

export type PhotoStatus = "idle" | "queued" | "processing" | "done" | "error";

export interface Photo {
  id: string;
  projectId: string;
  order: number;
  filename: string;
  width: number;
  height: number;
  originalFile: string; // relative path
  previewFile: string; // downscaled working file, relative path
  currentFile: string; // latest processed working (preview res) file
  finalFile?: string; // full-res generated on demand
  selected: boolean;
  locked: boolean; // protection of fixed elements
  status: PhotoStatus;
  errorMessage?: string;
  analysis?: PhotoAnalysis;
  history: HistoryStep[];
  historyIndex: number;
  naturalness: number; // 0-100
  createdAt: string;
  updatedAt: string;
}

export type HdrMode = "naturel" | "immobilier" | "premium" | "intense";
export type LightAuto = "faible" | "moyenne" | "forte" | "manuel";
export type ColorStyle = "naturel" | "lumineux" | "chaleureux" | "immobilier_premium" | "style_agence";
export type FidelityMode = "strict" | "commercial" | "virtual_staging";
export type AppMode = "simple" | "pro";

export interface ProjectSettings {
  intensity: number; // 0-100
  hdrMode: HdrMode;
  lightAuto: LightAuto;
  colorStyle: ColorStyle;
  harmonizeLot: boolean;
  fidelityMode: FidelityMode;
  appMode: AppMode;
}

export interface Project {
  id: string;
  name: string;
  address?: string;
  propertyType?: string;
  reference?: string;
  date?: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  photos: Photo[];
  coverPhotoId?: string;
}

export type JobItemStatus = "attente" | "traitement" | "termine" | "echec";

export interface JobItem {
  photoId: string;
  status: JobItemStatus;
  error?: string;
}

export type JobType =
  | "analyze"
  | "retouche_pro"
  | "hdr"
  | "luminosite"
  | "balance_blancs"
  | "perspective"
  | "grand_angle"
  | "nettete"
  | "debruitage"
  | "ciel"
  | "cadrage"
  | "contour"
  | "instruction"
  | "preset"
  | "suppression_objet"
  | "ajout_objet"
  | "desencombrement"
  | "virtual_staging"
  | "custom";

export interface Job {
  id: string;
  projectId: string;
  type: JobType;
  params: Record<string, unknown>;
  items: JobItem[];
  createdAt: string;
  finishedAt?: string;
  status: "en_cours" | "termine" | "echec";
}

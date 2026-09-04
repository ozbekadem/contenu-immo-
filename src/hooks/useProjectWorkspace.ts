"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import type { Job, JobType, Project } from "@/lib/types";
import type { LotRecommendation, DuplicatePair } from "@/lib/engine/recommendations";

export interface RecommendationsState {
  recommendations: LotRecommendation[];
  bestPhotoIds: string[];
  coverPhotoId: string | null;
  duplicates: DuplicatePair[];
}

export function useProjectWorkspace(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshProject = useCallback(async () => {
    const { project } = await api.getProject(projectId);
    setProject(project);
    return project;
  }, [projectId]);

  const refreshRecommendations = useCallback(async () => {
    try {
      const r = await api.recommendations(projectId);
      setRecommendations(r);
    } catch {
      /* non-critical */
    }
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { project } = await api.getProject(projectId);
      if (ignore) return;
      setProject(project);
      const r = await api.recommendations(projectId).catch(() => null);
      if (ignore) return;
      if (r) setRecommendations(r);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [projectId]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const { job } = await api.getJob(jobId);
          setActiveJob(job);
          if (job.status !== "en_cours") {
            stopPolling();
            await refreshProject();
            await refreshRecommendations();
          }
        } catch {
          stopPolling();
        }
      }, 700);
    },
    [refreshProject, refreshRecommendations, stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const runTool = useCallback(
    async (tool: JobType, scope: "this" | "selected" | "all", params: Record<string, unknown> = {}, photoId?: string) => {
      setError(null);
      try {
        const { job } = await api.enhance(projectId, tool, scope, params, photoId);
        setActiveJob(job);
        pollJob(job.id);
        return job;
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [projectId, pollJob]
  );

  const runAnalyze = useCallback(
    async (photoIds?: string[]) => {
      setError(null);
      const { job } = await api.analyze(projectId, photoIds);
      setActiveJob(job);
      pollJob(job.id);
      return job;
    },
    [projectId, pollJob]
  );

  const retryJob = useCallback(async () => {
    if (!activeJob) return;
    await api.retryJob(activeJob.id);
    pollJob(activeJob.id);
  }, [activeJob, pollJob]);

  return {
    project,
    setProject,
    loading,
    activeJob,
    recommendations,
    error,
    setError,
    refreshProject,
    refreshRecommendations,
    runTool,
    runAnalyze,
    retryJob,
  };
}

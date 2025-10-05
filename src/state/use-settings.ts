"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ClientSettings = {
  baseUrl?: string;
  model?: string;
  thinkingPrompt?: string;
  apiKey?: string;
  apiKeySet?: boolean;
  clearApiKey?: boolean;
  apiKey?: string;
  model?: string;
  thinkingPrompt?: string;
};

async function fetchSettings(): Promise<ClientSettings> {
  const response = await fetch("/api/settings", { cache: "no-store" });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Failed to load settings");
  }
  const data = (await response.json()) as { settings: ClientSettings };
  const settings = data.settings ?? {};
  return {
    ...settings,
    apiKey: "",
    clearApiKey: false,
  };
}

async function updateSettings(payload: ClientSettings): Promise<ClientSettings> {
  const body: Record<string, unknown> = {
    baseUrl: payload.baseUrl,
    model: payload.model,
    thinkingPrompt: payload.thinkingPrompt,
  };
  if (payload.apiKey && payload.apiKey.trim().length > 0) {
    body.apiKey = payload.apiKey.trim();
  }
  if (payload.clearApiKey) {
    body.clearApiKey = true;
  }
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Failed to save settings");
  }
  const data = (await response.json()) as { settings: ClientSettings };
  const settings = data.settings ?? {};
  return {
    ...settings,
    apiKey: "",
    clearApiKey: false,
  };
    throw new Error("Failed to load settings");
  }
  const data = (await response.json()) as { settings: ClientSettings };
  return data.settings ?? {};
}

async function updateSettings(payload: ClientSettings): Promise<ClientSettings> {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to save settings");
  }
  const data = (await response.json()) as { settings: ClientSettings };
  return data.settings ?? {};
}

export function useSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings"], queryFn: fetchSettings });
  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess(settings) {
      queryClient.setQueryData(["settings"], settings);
    },
  });

  return {
    settings: query.data ?? {},
    isLoading: query.isLoading,
    error: query.error,
    saveSettings: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}

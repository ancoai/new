"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ClientSettings = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  thinkingPrompt?: string;
};

async function fetchSettings(): Promise<ClientSettings> {
  const response = await fetch("/api/settings", { cache: "no-store" });
  if (!response.ok) {
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

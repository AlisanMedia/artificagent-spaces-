"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { localCatalog } from "@/composition/local-runtime";
import { ORGANIZATIONS, STUDIO_ORG } from "@/fixtures/properties";
import type { Organization, OrganizationId, PreviewPlan, Property, WorkspaceScope } from "@/domain/types";

interface WorkspaceContextValue {
  readonly organization: Organization;
  readonly scope: WorkspaceScope;
  readonly properties: readonly Property[];
  readonly plans: readonly PreviewPlan[];
  readonly reducedMotion: boolean;
  readonly setReducedMotion: (value: boolean) => void;
  readonly switchOrganization: (id: OrganizationId) => void;
  readonly savePlan: (plan: PreviewPlan) => void;
  readonly reset: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { readonly children: ReactNode }) {
  const [organizationId, setOrganizationId] = useState(STUDIO_ORG);
  const [allPlans, setAllPlans] = useState<readonly PreviewPlan[]>([]);
  const [reducedMotion, setReducedMotion] = useState(false);
  const switchOrganization = useCallback((id: OrganizationId) => {
    if (ORGANIZATIONS.some((organization) => organization.id === id)) setOrganizationId(id);
  }, []);
  const savePlan = useCallback((plan: PreviewPlan) => {
    if (plan.organizationId !== organizationId) return;
    setAllPlans((current) => [plan, ...current.filter((item) => item.id !== plan.id)]);
  }, [organizationId]);
  const reset = useCallback(() => {
    setAllPlans([]);
    setReducedMotion(false);
    setOrganizationId(STUDIO_ORG);
  }, []);
  const value = useMemo<WorkspaceContextValue>(() => {
    const scope = { organizationId };
    return {
      organization: ORGANIZATIONS.find((organization) => organization.id === organizationId)!,
      scope, properties: localCatalog.list(scope),
      plans: allPlans.filter((plan) => plan.organizationId === organizationId),
      reducedMotion, setReducedMotion, switchOrganization, savePlan, reset,
    };
  }, [organizationId, allPlans, reducedMotion, switchOrganization, savePlan, reset]);
  return <WorkspaceContext.Provider value={value}>
    <div data-reduced-motion={reducedMotion ? "true" : undefined}>{children}</div>
  </WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("WorkspaceProvider is required.");
  return context;
}

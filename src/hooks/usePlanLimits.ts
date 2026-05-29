import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlanStatus } from "@/lib/plans.functions";
import { supabase } from "@/integrations/supabase/client";

export interface PlanLimits {
  loading: boolean;
  planId: string;
  planName: string;
  currentCount: number;
  maxCount: number | null;
  usagePct: number;
  isExpired: boolean;
  expiresAt: string | null;
  canAddCustomer: boolean;
  isNearLimit: boolean;
  refresh: () => Promise<void>;
}

export function usePlanLimits(): PlanLimits {
  const fetchStatus = useServerFn(getMyPlanStatus);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({
    planId: "free",
    planName: "Free",
    currentCount: 0,
    maxCount: 50 as number | null,
    usagePct: 0,
    isExpired: false,
    expiresAt: null as string | null,
  });

  const refresh = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const data = await fetchStatus({
        headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
      });
      if (!data) return;
      setState({
        planId: data.plan_id ?? "free",
        planName: data.plan_name ?? "Free",
        currentCount: Number(data.customer_count ?? 0),
        maxCount: data.max_customers ?? null,
        usagePct: Number(data.usage_pct ?? 0),
        isExpired: Boolean(data.is_expired),
        expiresAt: data.plan_expires_at ?? null,
      });
    } catch (err) {
      console.error("[usePlanLimits]", err);
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canAddCustomer =
    state.maxCount === null || state.currentCount < state.maxCount;
  const isNearLimit =
    state.maxCount !== null && state.usagePct >= 80 && !state.isExpired;

  return {
    loading,
    ...state,
    canAddCustomer,
    isNearLimit,
    refresh,
  };
}

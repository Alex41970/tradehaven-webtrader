import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrices } from "@/contexts/PriceContext";
import { toast } from "@/hooks/use-toast";
import { alertCrossed, AlertDirection } from "@/utils/marketIntel";

export interface PriceAlert {
  id: string;
  symbol: string;
  direction: AlertDirection;
  target_price: number;
  is_active: boolean;
  triggered_at: string | null;
  created_at: string;
}

interface Ctx {
  alerts: PriceAlert[];
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  createAlert: (symbol: string, direction: AlertDirection, target: number) => Promise<boolean>;
  deleteAlert: (id: string) => Promise<void>;
  testChime: () => void;
}

const AlertsContext = createContext<Ctx | null>(null);
const SOUND_KEY = "price-alerts-sound";

function playChime() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio unavailable */
  }
}

export const PriceAlertsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { serverPrices } = usePrices();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [soundOn, setSoundOnState] = useState(() => localStorage.getItem(SOUND_KEY) !== "off");
  const prevRef = useRef<Map<string, number>>(new Map());
  const firing = useRef<Set<string>>(new Set());

  const setSoundOn = (v: boolean) => {
    setSoundOnState(v);
    localStorage.setItem(SOUND_KEY, v ? "on" : "off");
  };

  const load = useCallback(async () => {
    if (!user) return setAlerts([]);
    const { data } = await supabase.from("price_alerts").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
    setAlerts((data as PriceAlert[]) ?? []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Check active alerts against real server prices whenever they refresh
  useEffect(() => {
    if (!serverPrices.size) return;
    const prev = prevRef.current;
    alerts.filter((a) => a.is_active && !firing.current.has(a.id)).forEach((a) => {
      const cur = serverPrices.get(a.symbol);
      if (cur === undefined) return;
      if (alertCrossed(a.direction, Number(a.target_price), prev.get(a.symbol), cur)) {
        firing.current.add(a.id);
        if (soundOn) playChime();
        toast({ title: `🔔 ${a.symbol} ${a.direction === "above" ? "rose above" : "fell below"} ${Number(a.target_price)}`, description: `Current price ${cur}` });
        const now = new Date().toISOString();
        setAlerts((list) => list.map((x) => (x.id === a.id ? { ...x, is_active: false, triggered_at: now } : x)));
        supabase.from("price_alerts").update({ is_active: false, triggered_at: now }).eq("id", a.id).then(() => {});
      }
    });
    prevRef.current = new Map(serverPrices);
  }, [serverPrices, alerts, soundOn]);

  const createAlert = async (symbol: string, direction: AlertDirection, target: number) => {
    if (!user || !(target > 0)) return false;
    const { data, error } = await supabase.from("price_alerts").insert({ user_id: user.id, symbol, direction, target_price: target }).select().single();
    if (error || !data) {
      toast({ title: "Couldn't save alert", variant: "destructive" });
      return false;
    }
    setAlerts((l) => [data as PriceAlert, ...l]);
    toast({ title: "Alert set", description: `${symbol} ${direction} ${target}` });
    return true;
  };

  const deleteAlert = async (id: string) => {
    setAlerts((l) => l.filter((a) => a.id !== id));
    await supabase.from("price_alerts").delete().eq("id", id);
  };

  return (
    <AlertsContext.Provider value={{ alerts, soundOn, setSoundOn, createAlert, deleteAlert, testChime: playChime }}>
      {children}
    </AlertsContext.Provider>
  );
};

export const usePriceAlerts = () => {
  const c = useContext(AlertsContext);
  if (!c) throw new Error("usePriceAlerts must be used inside PriceAlertsProvider");
  return c;
};

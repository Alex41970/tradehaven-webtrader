import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface Watchlist {
  id: string;
  name: string;
  sort_order: number;
  assetIds: string[];
}

export const useWatchlists = () => {
  const { user } = useAuth();
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLists([]); setLoading(false); return; }
    const [{ data: wl }, { data: items }] = await Promise.all([
      supabase.from("watchlists").select("id,name,sort_order,created_at").eq("user_id", user.id).order("sort_order").order("created_at"),
      supabase.from("watchlist_items").select("watchlist_id,asset_id").eq("user_id", user.id),
    ]);
    setLists((wl ?? []).map((w) => ({ id: w.id, name: w.name, sort_order: w.sort_order, assetIds: (items ?? []).filter((i) => i.watchlist_id === w.id).map((i) => i.asset_id) })));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const createList = async (name: string) => {
    if (!user || !name.trim()) return null;
    const { data, error } = await supabase.from("watchlists").insert({ user_id: user.id, name: name.trim().slice(0, 40), sort_order: lists.length }).select().single();
    if (error || !data) { toast({ title: "Couldn't create list", variant: "destructive" }); return null; }
    setLists((l) => [...l, { id: data.id, name: data.name, sort_order: data.sort_order, assetIds: [] }]);
    return data.id as string;
  };

  const renameList = async (id: string, name: string) => {
    if (!name.trim()) return;
    setLists((l) => l.map((w) => (w.id === id ? { ...w, name: name.trim().slice(0, 40) } : w)));
    await supabase.from("watchlists").update({ name: name.trim().slice(0, 40) }).eq("id", id);
  };

  const deleteList = async (id: string) => {
    setLists((l) => l.filter((w) => w.id !== id));
    await supabase.from("watchlists").delete().eq("id", id);
  };

  const toggleItem = async (listId: string, assetId: string) => {
    if (!user) return;
    const list = lists.find((w) => w.id === listId);
    if (!list) return;
    const has = list.assetIds.includes(assetId);
    setLists((l) => l.map((w) => (w.id === listId ? { ...w, assetIds: has ? w.assetIds.filter((a) => a !== assetId) : [...w.assetIds, assetId] } : w)));
    if (has) await supabase.from("watchlist_items").delete().eq("watchlist_id", listId).eq("asset_id", assetId);
    else await supabase.from("watchlist_items").insert({ watchlist_id: listId, asset_id: assetId, user_id: user.id });
  };

  const inAnyList = (assetId: string) => lists.some((w) => w.assetIds.includes(assetId));

  return { lists, loading, createList, renameList, deleteList, toggleItem, inAnyList, refetch: load };
};

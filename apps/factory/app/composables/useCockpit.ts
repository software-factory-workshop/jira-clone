import { onBeforeUnmount, onMounted, readonly } from "vue";
import type { CockpitRecord, Collection } from "../../shared/cockpit";

type CockpitItems = Record<Collection, CockpitRecord[]>;

type CollectionResponse = {
  items: CockpitRecord[];
};

type RecordResponse = {
  item: CockpitRecord;
};

function emptyCockpitItems(): CockpitItems {
  return { drafts: [], feedback: [], runs: [] };
}

function emptyRefreshedAt(): Record<Collection, number> {
  return { drafts: 0, feedback: 0, runs: 0 };
}

interface WatchCollectionOptions {
  intervalMs?: number;
  onRefresh?: (records: CockpitRecord[]) => void;
  onError?: (cause: unknown) => void;
}

export function useCockpit() {
  const items = useState<CockpitItems>("cockpit-items", emptyCockpitItems);
  const refreshedAt = useState<Record<Collection, number>>("cockpit-refreshed-at", emptyRefreshedAt);

  function replaceCollection(
    collection: Collection,
    records: CockpitRecord[],
  ): void {
    // Replace the root state so every consumer observes the same immutable
    // snapshot. Consumers can inspect records, but only this composable can
    // mutate the shared collection.
    items.value = { ...items.value, [collection]: records };
  }

  async function refresh(collection: Collection): Promise<CockpitRecord[]> {
    const response = await $fetch<CollectionResponse>(
      `/factory/cockpit/records/${collection}`,
      { retry: 0 },
    );
    replaceCollection(collection, response.items);
    refreshedAt.value = { ...refreshedAt.value, [collection]: Date.now() };
    return response.items;
  }

  function watchCollection(collection: Collection, options: WatchCollectionOptions = {}): void {
    if (!import.meta.client) return;
    const intervalMs = options.intervalMs ?? 10_000;
    let timer: number | undefined;
    let stopped = false;
    let refreshing = false;

    async function refreshIfStale() {
      if (stopped || refreshing || document.visibilityState !== "visible") return;
      if (Date.now() - refreshedAt.value[collection] < intervalMs) return;
      refreshing = true;
      try {
        const records = await refresh(collection);
        options.onRefresh?.(records);
      } catch (cause) {
        options.onError?.(cause);
      } finally {
        refreshing = false;
      }
    }

    function onVisible() {
      void refreshIfStale();
    }

    onMounted(() => {
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", onVisible);
      timer = window.setInterval(onVisible, intervalMs);
    });

    onBeforeUnmount(() => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (timer !== undefined) window.clearInterval(timer);
    });
  }

  async function save(
    collection: Collection,
    id: string,
    value: Record<string, unknown>,
    expectedVersion = 0,
  ): Promise<CockpitRecord> {
    const response = await $fetch<RecordResponse>(
      `/factory/cockpit/records/${collection}/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: { value, expectedVersion },
        retry: 0,
      },
    );
    replaceCollection(collection, [
      response.item,
      ...items.value[collection].filter((record) => record.id !== id),
    ]);
    return response.item;
  }

  async function remove(
    collection: Collection,
    item: CockpitRecord,
  ): Promise<void> {
    await $fetch(
      `/factory/cockpit/records/${collection}/${encodeURIComponent(item.id)}`,
      {
        method: "DELETE",
        body: { expectedVersion: item.version },
        retry: 0,
      },
    );
    replaceCollection(
      collection,
      items.value[collection].filter((record) => record.id !== item.id),
    );
  }

  // Legacy storage remains untouched. Import only missing records, never
  // replace shared edits with a browser snapshot; repeat imports are safe.
  async function migrate(
    collection: Collection,
    legacy: Array<{ id: string; value: Record<string, unknown> }>,
  ): Promise<void> {
    if (legacy.length) {
      await $fetch("/factory/cockpit/import", {
        method: "POST",
        body: { collection, items: legacy },
        retry: 0,
      });
    }
    await refresh(collection);
  }

  return {
    items: readonly(items),
    refresh,
    watchCollection,
    save,
    remove,
    migrate,
  };
}

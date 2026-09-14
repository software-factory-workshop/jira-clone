import { readonly } from "vue";
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

export function useCockpit() {
  const items = useState<CockpitItems>("cockpit-items", emptyCockpitItems);

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
    return response.items;
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
    save,
    remove,
    migrate,
  };
}

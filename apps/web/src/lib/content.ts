import { getCollection, type CollectionEntry } from "astro:content";

export async function getGuideEntries(): Promise<CollectionEntry<"guides">[]> {
  const entries = await getCollection("guides");
  return entries.sort(
    (
      left: CollectionEntry<"guides">,
      right: CollectionEntry<"guides">
    ) => right.data.publishedAt.getTime() - left.data.publishedAt.getTime()
  );
}

export async function getPortEntries(): Promise<CollectionEntry<"ports">[]> {
  const entries = await getCollection("ports");
  return entries.sort(
    (left: CollectionEntry<"ports">, right: CollectionEntry<"ports">) =>
      left.data.port - right.data.port
  );
}

export function formatPublishedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC"
  }).format(date);
}

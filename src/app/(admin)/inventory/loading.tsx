import { ListPageSkeleton } from "@/components/skeletons/page-skeletons";

export default function Loading() {
  return <ListPageSkeleton title="Inventory" rows={6} filters={false} />;
}

import { ListPageSkeleton } from "@/components/skeletons/page-skeletons";

export default function Loading() {
  return <ListPageSkeleton title="Suppliers" rows={5} filters={false} />;
}

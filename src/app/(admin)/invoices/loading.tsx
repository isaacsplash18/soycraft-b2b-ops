import { ListPageSkeleton } from "@/components/skeletons/page-skeletons";

export default function Loading() {
  return <ListPageSkeleton title="Invoices" rows={8} />;
}

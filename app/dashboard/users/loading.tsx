import { TableSkeleton } from "@/components/skeletons";

export default function UsersLoading() {
  return <TableSkeleton title="Users" rows={5} />;
}

import { TableSkeleton } from "@/components/skeletons";

export default function TasksLoading() {
  return <TableSkeleton title="Tasks" rows={4} />;
}

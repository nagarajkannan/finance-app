import { SnapshotDetail } from "./snapshot-detail";

export default async function SnapshotPage({ params }: PageProps<"/snapshots/[id]">) {
  const { id } = await params;
  return <SnapshotDetail snapshotId={id} />;
}

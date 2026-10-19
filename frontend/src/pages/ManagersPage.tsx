import { useMemo } from "react";
import { loadSnapshot } from "../services/api";
import { useLoad } from "../lib/hooks";
import { scoreManagers } from "../lib/metrics";
import ManagerBoard from "../components/ManagerBoard";
import { LoadFail } from "../components/blocks";
import { PageHead, Skeleton } from "../components/ui";

export default function ManagersPage({ go }: { go: (p: string, ctx?: any) => void }) {
  const { data: s, error } = useLoad(loadSnapshot, [], 30000);
  const scores = useMemo(() => (s ? scoreManagers(s) : []), [s]);
  return (
    <div className="wrap page">
      <PageHead kicker="Owner · accountability" title="Manager" em="scorecards" lead="One score per warehouse manager, rebuilt from live data every 30 seconds. Open any card to see what is helping or hurting it." />
      <LoadFail error={error} />
      {!s ? <Skeleton rows={6} /> : <ManagerBoard scores={scores} go={go} />}
    </div>
  );
}

import { Suspense } from "react";
import { Staking } from "@/components/Staking";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function StakingPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="table" />}>
      <Staking />
    </Suspense>
  );
}

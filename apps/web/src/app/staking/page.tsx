import { Suspense } from "react";
import { Staking } from "@/components/Staking";

export default function StakingPage() {
  return (
    <Suspense>
      <Staking />
    </Suspense>
  );
}

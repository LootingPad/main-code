import { Suspense } from "react";
import { Explore } from "@/components/Explore";
import { PageSkeleton } from "@/components/PageSkeleton";

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="table" />}>
      <Explore />
    </Suspense>
  );
}

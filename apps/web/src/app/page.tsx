import { Suspense } from "react";
import { Explore } from "@/components/Explore";

export default function HomePage() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}

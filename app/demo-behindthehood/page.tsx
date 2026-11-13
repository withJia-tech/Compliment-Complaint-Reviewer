import type { Metadata } from "next";
import { BehindTheHood } from "@/app/components/BehindTheHood";

export const metadata: Metadata = {
  title: "Behind the hood · Review Desk",
  description: "Engineering evidence, decision rubrics and controlled execution boundaries for the Review Desk demo.",
};

export default function BehindTheHoodPage() {
  return <BehindTheHood />;
}

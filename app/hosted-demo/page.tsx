import { buildDemoDatasets } from "@/lib/demo/datasets";
import { HostedDemo } from "./sandbox";

export default function HostedDemoPage() {
  return <HostedDemo datasets={buildDemoDatasets()} />;
}

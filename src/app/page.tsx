import Dashboard from "@/components/dashboard/dashboard";
import { loadDemoFixtures } from "@/lib/domain/fixtures";

export default function Home() {
  return <Dashboard fixtures={loadDemoFixtures()} />;
}

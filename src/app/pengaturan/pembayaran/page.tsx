import { redirect } from "next/navigation";
import { features } from "@/lib/config/features";
import { PgSetupView } from "@/components/pengaturan/pg-setup-view";

// Halaman setup PG. Hanya tersedia bila build v3 (features.pgConnector).
export default function PembayaranPage() {
  if (!features.pgConnector) redirect("/pengaturan");
  return <PgSetupView />;
}

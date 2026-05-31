import { cookies } from "next/headers";
import { redirect } from "next/navigation";

// Server component: arahkan sesuai status aktivasi.
export default async function Home() {
  const store = await cookies();
  const umkmId = store.get("umkm_id")?.value;
  redirect(umkmId ? "/dashboard" : "/aktivasi");
}

import { supabase } from "../supabase/client";
import { jakartaDateStr, startOfDaysAgoISO } from "../utils/date";

const TZ = "Asia/Jakarta";
const OFFSET_MS = 7 * 60 * 60 * 1000;
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export interface OmzetHari {
  tanggal: string;
  total: number;
  label: string;
}

function jakartaNowParts() {
  const jak = new Date(Date.now() + OFFSET_MS);
  return { y: jak.getUTCFullYear(), m: jak.getUTCMonth(), d: jak.getUTCDate() };
}

function labelHari(tanggal: string): string {
  const dt = new Date(`${tanggal}T12:00:00`);
  return HARI[dt.getDay()] ?? "";
}

export async function getOmzetDuaMinggu(umkmId: string): Promise<{ ini: OmzetHari[]; lalu: OmzetHari[] }> {
  const { data, error } = await supabase
    .from("transaksi").select("created_at, grand_total")
    .eq("umkm_id", umkmId).eq("status", "completed").gte("created_at", startOfDaysAgoISO(14));
  if (error) throw error;

  const byDate = new Map<string, number>();
  for (const row of (data ?? []) as { created_at: string; grand_total: number }[]) {
    const ds = jakartaDateStr(row.created_at);
    byDate.set(ds, (byDate.get(ds) ?? 0) + row.grand_total);
  }

  const { y, m, d } = jakartaNowParts();
  const build = (startOffset: number): OmzetHari[] => {
    const out: OmzetHari[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(Date.UTC(y, m, d - startOffset + i, 12, 0, 0));
      const tanggal = dt.toLocaleDateString("en-CA", { timeZone: TZ });
      out.push({ tanggal, total: byDate.get(tanggal) ?? 0, label: labelHari(tanggal) });
    }
    return out;
  };

  return { ini: build(6), lalu: build(13) };
}

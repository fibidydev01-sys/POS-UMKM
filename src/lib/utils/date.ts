// Format tanggal Indonesia + helper batas hari zona Asia/Jakarta (UTC+7, tanpa DST).

const TZ = "Asia/Jakarta";
const OFFSET_MS = 7 * 60 * 60 * 1000;

// ── Format tampilan ──────────────────────────────────────────
export function formatTanggal(input: string | Date): string {
  return new Date(input).toLocaleDateString("id-ID", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function formatTanggalPanjang(input: string | Date): string {
  return new Date(input).toLocaleDateString("id-ID", {
    timeZone: TZ, day: "numeric", month: "long", year: "numeric",
  });
}

export function formatJam(input: string | Date): string {
  return new Date(input).toLocaleTimeString("id-ID", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit",
  });
}

export function formatTanggalJam(input: string | Date): string {
  return `${formatTanggal(input)} · ${formatJam(input)}`;
}

export function formatBulanTahun(input: string | Date = new Date()): string {
  return new Date(input).toLocaleDateString("id-ID", {
    timeZone: TZ, month: "long", year: "numeric",
  });
}

/** Sapaan sesuai jam Jakarta. */
export function sapaan(): string {
  const jam = parseInt(
    new Date().toLocaleString("en-US", { timeZone: TZ, hour: "2-digit", hour12: false }),
    10
  );
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 19) return "Selamat sore";
  return "Selamat malam";
}

// ── Helper bucketing & batas waktu ───────────────────────────
/** "YYYY-MM-DD" menurut zona Jakarta — untuk mengelompokkan per hari. */
export function jakartaDateStr(input: string | Date): string {
  return new Date(input).toLocaleDateString("en-CA", { timeZone: TZ });
}

function jakartaNowParts() {
  const jak = new Date(Date.now() + OFFSET_MS);
  return { y: jak.getUTCFullYear(), m: jak.getUTCMonth(), d: jak.getUTCDate() };
}

/** ISO (UTC) dari awal hari ini (00:00 Jakarta). */
export function startOfTodayISO(): string {
  const { y, m, d } = jakartaNowParts();
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - OFFSET_MS).toISOString();
}

/** ISO (UTC) dari awal bulan berjalan (tgl 1, 00:00 Jakarta). */
export function startOfMonthISO(): string {
  const { y, m } = jakartaNowParts();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - OFFSET_MS).toISOString();
}

/** ISO (UTC) dari awal hari, n hari lalu (n=7 → mencakup 7 hari termasuk hari ini). */
export function startOfDaysAgoISO(n: number): string {
  const { y, m, d } = jakartaNowParts();
  return new Date(Date.UTC(y, m, d - (n - 1), 0, 0, 0) - OFFSET_MS).toISOString();
}

/** Daftar n tanggal Jakarta terakhir (lama→baru) sebagai "YYYY-MM-DD" + label "DD/MM". */
export function nHariTerakhir(n: number): { tanggal: string; label: string }[] {
  const { y, m, d } = jakartaNowParts();
  const out: { tanggal: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m, d - i, 12, 0, 0)); // siang utk hindari geser tgl
    const tanggal = dt.toLocaleDateString("en-CA", { timeZone: TZ });
    const label = dt.toLocaleDateString("id-ID", { timeZone: TZ, day: "2-digit", month: "2-digit" });
    out.push({ tanggal, label });
  }
  return out;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartItem, HasilTransaksi } from "@/lib/db/transaksi";

export type SessionState = "idle" | "creating" | "pending" | "paid" | "expired" | "failed";

export interface CreateSessionPayload {
  cart: CartItem[];
  diskonPresetId: string | null;
  diskonPersen: number;
  label: string;
}

const POLL_MS = 2500;

/**
 * Mesin status QRIS untuk kasir (L5, R7).
 *   idle → creating → pending(poll) → paid | expired | failed
 * Countdown dihitung dari `expires_at` server. `regenerate()` membuat ulang QR
 * (idempotency dijaga server, R6). `checkNow()` memaksa polling sekali (tombol
 * "Cek status pembayaran"). Interval dibersihkan saat unmount.
 */
export function usePaymentSession() {
  const [state, setState] = useState<SessionState>("idle");
  const [qrString, setQrString] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [struk, setStruk] = useState<HasilTransaksi | null>(null);
  const [checking, setChecking] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPayloadRef = useRef<CreateSessionPayload | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  const stopTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPoll();
    stopTick();
    sessionIdRef.current = null;
    lastPayloadRef.current = null;
    setState("idle");
    setQrString(null);
    setQrUrl(null);
    setProvider(null);
    setExpiresAt(null);
    setSecondsLeft(0);
    setError(null);
    setStruk(null);
    setChecking(false);
  }, [stopPoll, stopTick]);

  const startCountdown = useCallback(
    (iso: string) => {
      stopTick();
      const compute = () => Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
      setSecondsLeft(compute());
      tickRef.current = setInterval(() => {
        const s = compute();
        setSecondsLeft(s);
        if (s <= 0) stopTick();
      }, 1000);
    },
    [stopTick]
  );

  /** Single status fetch. Returns true if a terminal state was reached. */
  const fetchStatusOnce = useCallback(async (): Promise<boolean> => {
    const id = sessionIdRef.current;
    if (!id) return false;
    try {
      const res = await fetch(`/api/payment/status?sessionId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!data?.ok) return false;
      if (data.status === "paid") {
        stopPoll();
        stopTick();
        if (data.struk) setStruk(data.struk as HasilTransaksi);
        setState("paid");
        return true;
      }
      if (data.status === "expired") {
        stopPoll();
        stopTick();
        setState("expired");
        return true;
      }
      if (data.status === "failed") {
        stopPoll();
        stopTick();
        setState("failed");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [stopPoll, stopTick]);

  const poll = useCallback(() => {
    void fetchStatusOnce();
  }, [fetchStatusOnce]);

  /** Manual "Cek status pembayaran" — force an immediate poll with UI feedback. */
  const checkNow = useCallback(async () => {
    if (!sessionIdRef.current || checking) return;
    setChecking(true);
    try {
      await fetchStatusOnce();
    } finally {
      setChecking(false);
    }
  }, [checking, fetchStatusOnce]);

  const create = useCallback(
    async (payload: CreateSessionPayload) => {
      reset();
      lastPayloadRef.current = payload;
      setState("creating");
      try {
        const res = await fetch("/api/payment/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          setError(data?.pesan ?? "Gagal membuat QR.");
          setState("failed");
          return;
        }
        sessionIdRef.current = data.sessionId;
        setQrString(data.qr_string ?? null);
        setQrUrl(data.qr_url ?? null);
        setProvider(data.provider ?? null);
        setExpiresAt(data.expires_at ?? null);
        if (data.expires_at) startCountdown(data.expires_at);
        setState("pending");
        stopPoll();
        pollRef.current = setInterval(poll, POLL_MS);
        setTimeout(poll, 1200);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal menghubungi server.");
        setState("failed");
      }
    },
    [reset, startCountdown, poll, stopPoll]
  );

  const regenerate = useCallback(async () => {
    const p = lastPayloadRef.current;
    if (p) await create(p);
  }, [create]);

  useEffect(
    () => () => {
      stopPoll();
      stopTick();
    },
    [stopPoll, stopTick]
  );

  return {
    state,
    qrString,
    qrUrl,
    provider,
    expiresAt,
    secondsLeft,
    error,
    struk,
    checking,
    create,
    regenerate,
    checkNow,
    reset,
  };
}

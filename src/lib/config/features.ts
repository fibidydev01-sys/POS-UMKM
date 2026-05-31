const VERSION = (process.env.NEXT_PUBLIC_POS_VERSION ?? "v1").trim().toLowerCase();
const isV2 = VERSION === "v2";

export const features = {
  payment: isV2,
  refund: isV2,
  promoEngine: isV2,
  promoManagement: isV2,
} as const;

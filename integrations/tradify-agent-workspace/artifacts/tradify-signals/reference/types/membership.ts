export type MembershipTier = "FREE" | "PRO";

export interface MembershipPlan {
  id: MembershipTier;
  name: string;
  price: number;
  interval: "month" | "year";
}

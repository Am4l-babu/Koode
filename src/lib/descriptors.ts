import type {
  DeliveryMethod,
  DonationStatus,
  DonorGroupType,
  ItemCondition,
  OrganizationType,
  Priority,
  RequestStatus,
  VerificationStatus,
} from "@prisma/client";

/** Safe, dignified public descriptor for each organisation type. */
export const ORG_DESCRIPTORS: Record<OrganizationType, string> = {
  PLAY_SCHOOL: "Verified Early Learning Center",
  SCHOOL: "Verified Learning Center",
  ORPHANAGE: "Verified Children's Center",
  OLD_AGE_HOME: "Verified Elder Care Home",
  NGO: "Verified Community Organization",
  COMMUNITY_ORGANIZATION: "Verified Community Organization",
  SHELTER: "Verified Community Shelter",
  CARE_CENTER: "Verified Care Center",
  INDIVIDUAL: "Verified Recipient",
};

export const ORG_TYPE_LABELS: Record<OrganizationType, string> = {
  PLAY_SCHOOL: "Play school",
  SCHOOL: "School",
  ORPHANAGE: "Children's home",
  OLD_AGE_HOME: "Elder care home",
  NGO: "NGO",
  COMMUNITY_ORGANIZATION: "Community organization",
  SHELTER: "Shelter",
  CARE_CENTER: "Care center",
  INDIVIDUAL: "Individual (where permitted)",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  NORMAL: "Normal",
};

export const PRIORITY_ORDER: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "NORMAL"];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: "Draft",
  PENDING_VERIFICATION: "Pending verification",
  NEEDS_INFO: "More information requested",
  ACTIVE: "Active",
  FULFILLED: "Fulfilled",
  CLOSED: "Closed",
  REJECTED: "Not approved",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: "Pending",
  UNDER_REVIEW: "Under review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

export const DONATION_STATUS_FLOW: DonationStatus[] = [
  "CREATED",
  "CONFIRMED",
  "PREPARING",
  "IN_TRANSIT",
  "RECEIVED",
  "COMPLETED",
];

export const DONATION_STATUS_LABELS: Record<DonationStatus, string> = {
  CREATED: "Donation created",
  CONFIRMED: "Donation confirmed",
  PREPARING: "Preparing",
  IN_TRANSIT: "In transit",
  RECEIVED: "Received",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  PLATFORM_PICKUP: "Platform pickup",
  PARTNER_DROPOFF: "Partner drop-off point",
  DELIVERY: "Courier delivery",
};

export const CONDITION_LABELS: Record<ItemCondition, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
};

export const GROUP_LABELS: Record<DonorGroupType, string> = {
  INDIVIDUAL: "Individual",
  COMMUNITY_GROUP: "Community group",
  COMPANY: "Company",
  SCHOOL: "School",
  COLLEGE: "College",
  CLUB: "Club",
};

/** How a donor appears to a recipient. Never contains identifying data. */
export function donorDisplayName(alias: string, groupType: DonorGroupType): string {
  if (groupType === "INDIVIDUAL") return `Community Donor #${alias}`;
  return `Community ${GROUP_LABELS[groupType]} Donor #${alias}`;
}

/**
 * Every notification the platform sends is built here, from references only.
 * No template accepts a name, email, phone or address — which makes it
 * structurally impossible for a notification to leak an identity.
 */
export interface NotificationTemplate {
  type: string;
  title: string;
  body: string;
  link?: string;
}

type Qty = { quantity: number; name: string };
const qtyList = (items: Qty[]) => items.map((i) => `${i.quantity} × ${i.name}`).join(", ");

export const templates = {
  donationCreatedDonor: (donationId: string): NotificationTemplate => ({
    type: "DONATION_CREATED",
    title: "Donation confirmed",
    body: `Thank you. Your donation ${donationId} is confirmed, and your identity remains private.`,
    link: `/donor/donations/${donationId}`,
  }),
  donationCommittedRecipient: (requestId: string, items: Qty[]): NotificationTemplate => ({
    type: "DONATION_COMMITTED",
    title: "New anonymous donation",
    body: `An anonymous donor has committed ${qtyList(items)} to your request ${requestId}.`,
    link: `/recipient/donations`,
  }),
  donationStatusDonor: (donationId: string, statusLabel: string): NotificationTemplate => ({
    type: "DONATION_STATUS",
    title: `Donation ${statusLabel.toLowerCase()}`,
    body: `Your donation ${donationId} is now: ${statusLabel}.`,
    link: `/donor/donations/${donationId}`,
  }),
  donationReceivedDonor: (donationId: string): NotificationTemplate => ({
    type: "DONATION_RECEIVED",
    title: "Your donation was received",
    body: `Your donation ${donationId} has been received. Thank you for supporting a verified community need.`,
    link: `/donor/donations/${donationId}`,
  }),
  donationShippedRecipient: (donationId: string, courierName: string, updated: boolean): NotificationTemplate => ({
    type: "DONATION_STATUS",
    title: updated ? "Tracking details updated" : "Donation sent by courier",
    body: updated
      ? `The donor updated the courier tracking for donation ${donationId}.`
      : `Donation ${donationId} is on its way with ${courierName}. You can follow it from your donations page.`,
    link: `/recipient/donations`,
  }),
  donationStatusRecipient: (donationId: string, statusLabel: string): NotificationTemplate => ({
    type: "DONATION_STATUS",
    title: `Donation ${statusLabel.toLowerCase()}`,
    body: `Donation ${donationId} to your organisation is now: ${statusLabel}.`,
    link: `/recipient/donations`,
  }),
  donationCancelledRecipient: (donationId: string): NotificationTemplate => ({
    type: "DONATION_CANCELLED",
    title: "A donation was withdrawn",
    body: `Donation ${donationId} was withdrawn. The quantity is available to other donors again.`,
    link: `/recipient/donations`,
  }),
  requestApproved: (requestId: string): NotificationTemplate => ({
    type: "REQUEST_APPROVED",
    title: "Your request is live",
    body: `Request ${requestId} was approved and is now visible to donors.`,
    link: `/recipient/requests/${requestId}`,
  }),
  requestRejected: (requestId: string): NotificationTemplate => ({
    type: "REQUEST_REJECTED",
    title: "Request not approved",
    body: `Request ${requestId} was not approved at this time. Please review the reviewer's note; you are welcome to update and resubmit.`,
    link: `/recipient/requests/${requestId}`,
  }),
  requestNeedsInfo: (requestId: string): NotificationTemplate => ({
    type: "REQUEST_NEEDS_INFO",
    title: "More information requested",
    body: `The review team needs a little more information about request ${requestId}.`,
    link: `/recipient/requests/${requestId}`,
  }),
  requestFulfilled: (requestId: string): NotificationTemplate => ({
    type: "REQUEST_FULFILLED",
    title: "Request fully committed",
    body: `Every item in request ${requestId} has been committed by anonymous donors.`,
    link: `/recipient/requests/${requestId}`,
  }),
  verificationDecision: (status: string): NotificationTemplate => ({
    type: "VERIFICATION_DECISION",
    title: status === "VERIFIED" ? "Your organisation is verified" : "Verification update",
    body:
      status === "VERIFIED"
        ? "Your organisation is verified. You can now publish requests."
        : `Your verification status is now: ${status.replace("_", " ").toLowerCase()}.`,
    link: `/recipient/verification`,
  }),
  mediaDecisionDonor: (donationId: string, approved: boolean, kind: "photo" | "video"): NotificationTemplate => ({
    type: "MEDIA_DECISION",
    title: approved ? `Your ${kind} was approved` : `A ${kind} was not approved`,
    body: approved
      ? `The ${kind} you added to donation ${donationId} was approved and is now visible to the organisation.`
      : `A ${kind} on donation ${donationId} could not be approved, so the organisation will not see it. You can upload a different one.`,
    link: `/donor/donations/${donationId}`,
  }),
  adminMediaAwaiting: (donationId: string): NotificationTemplate => ({
    type: "ADMIN_MEDIA",
    title: "Video awaiting review",
    body: `A video attached to donation ${donationId} is waiting for approval.`,
    link: `/admin/donations`,
  }),
  adminNewVerification: (orgRef: string): NotificationTemplate => ({
    type: "ADMIN_VERIFICATION",
    title: "Verification awaiting review",
    body: `New organisation verification request (${orgRef}) requires review.`,
    link: `/admin/verifications`,
  }),
  adminNewRequest: (requestId: string): NotificationTemplate => ({
    type: "ADMIN_REQUEST",
    title: "Request awaiting review",
    body: `Request ${requestId} is waiting for moderation.`,
    link: `/admin/requests`,
  }),
  adminReport: (requestId: string): NotificationTemplate => ({
    type: "ADMIN_REPORT",
    title: "A request was reported",
    body: `Request ${requestId} was reported and added to the investigation queue.`,
    link: `/admin/requests?tab=reports`,
  }),
  adminSuspicious: (donationId: string, reason: string): NotificationTemplate => ({
    type: "ADMIN_FRAUD",
    title: "Unusual donation activity",
    body: `Donation ${donationId} was flagged: ${reason}.`,
    link: `/admin/donations`,
  }),
};

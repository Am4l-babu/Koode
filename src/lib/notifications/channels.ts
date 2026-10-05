import "server-only";
import { env } from "../env";

/**
 * Delivery channel abstraction. In-app notifications are stored in the DB by
 * the notification service; these drivers handle out-of-band delivery.
 * Message bodies are composed from privacy-safe templates only.
 */
export interface OutboundMessage {
  to: string;
  subject?: string;
  text: string;
}

export interface Channel {
  name: "email" | "sms" | "whatsapp" | "push";
  send(message: OutboundMessage): Promise<void>;
}

/** Captured messages in non-production for tests and local debugging. */
const g = globalThis as unknown as { __outbox?: (OutboundMessage & { channel: string })[] };
export const outbox = (g.__outbox ??= []);

function consoleChannel(name: Channel["name"]): Channel {
  return {
    name,
    async send(message) {
      outbox.push({ ...message, channel: name });
      if (outbox.length > 200) outbox.shift();
      if (process.env.NODE_ENV !== "test") {
        // Recipient address is masked even in dev logs.
        console.info(`[${name}] → ${mask(message.to)} :: ${message.subject ?? ""} ${message.text}`);
      }
    },
  };
}

function resendChannel(): Channel {
  return {
    name: "email",
    async send(message) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: message.to,
          subject: message.subject,
          text: message.text,
        }),
      });
      if (!res.ok) throw new Error(`Email delivery failed with status ${res.status}`);
    },
  };
}

const disabled = (name: Channel["name"]): Channel => ({ name, async send() {} });

export function emailChannel(): Channel {
  return env.emailDriver === "resend" ? resendChannel() : env.emailDriver === "disabled" ? disabled("email") : consoleChannel("email");
}

export function smsChannel(): Channel {
  return env.smsDriver === "console" ? consoleChannel("sms") : disabled("sms");
}

export function whatsappChannel(): Channel {
  return env.whatsappDriver === "console" ? consoleChannel("whatsapp") : disabled("whatsapp");
}

export function mask(address: string): string {
  if (address.includes("@")) {
    const [user, domain] = address.split("@");
    return `${user!.slice(0, 2)}***@${domain}`;
  }
  return `${address.slice(0, 3)}*****${address.slice(-2)}`;
}

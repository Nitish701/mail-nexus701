const DEFAULT_WEBHOOK_PATH = "/webhooks/email";

export default {
	async email(message, env) {
		const webhookUrl = env.WEBHOOK_URL;

		if (!webhookUrl) {
			message.setReject("Email ingestion is not configured");
			return;
		}

		const headers = new Headers({
			"Content-Type": "message/rfc822",
			"X-Mail-Nexus-From": message.from,
			"X-Mail-Nexus-To": message.to,
		});

		if (message.headers?.get("Message-ID")) {
			headers.set("X-Mail-Nexus-Message-Id", message.headers.get("Message-ID"));
		}

		if (env.WEBHOOK_SECRET) {
			headers.set("Authorization", `Bearer ${env.WEBHOOK_SECRET}`);
		}

		const response = await fetch(new URL(DEFAULT_WEBHOOK_PATH, webhookUrl), {
			method: "POST",
			headers,
			body: message.raw,
		});

		if (!response.ok) {
			message.setReject(`Webhook rejected email with HTTP ${response.status}`);
		}
	},
};

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

		const rawEmail = await new Response(message.raw).arrayBuffer();
		let lastStatus = "network error";
		try {
			for (let attempt = 1; attempt <= 3; attempt += 1) {
				try {
					const response = await fetch(new URL(DEFAULT_WEBHOOK_PATH, webhookUrl), {
						method: "POST",
						headers,
						body: rawEmail,
					});

					if (response.ok) {
						return;
					}
					lastStatus = `HTTP ${response.status}`;
				} catch (error) {
					lastStatus = "network error";
					console.error(`Webhook attempt ${attempt} failed`, error);
				}
				if (attempt < 3) {
					await new Promise((resolve) => setTimeout(resolve, attempt * 500));
				}
			}
			console.error(`Webhook rejected email after 3 attempts: ${lastStatus}`);
			message.setReject(`Webhook rejected email after 3 attempts: ${lastStatus}`);
		} catch (error) {
			console.error("Email webhook preparation failed", error);
			message.setReject("Email webhook preparation failed");
		}
	},
};

/**
 * Zero-dependency Web Crypto implementation of:
 * - RFC 8292: Voluntary Application Server Identification (VAPID) for Web Push
 * - RFC 8291: Message Encryption for Web Push (aes128gcm)
 * - RFC 8188: Encrypted Content-Encoding for HTTP
 */

export interface VapidKeys {
	publicKey: string; // 65-byte uncompressed P-256 public key (base64url)
	privateKey: string; // 32-byte P-256 private key scalar 'd' (base64url)
}

export interface PushSubscriptionKeys {
	p256dh: string; // Client ECDH P-256 public key (base64url)
	auth: string; // 16-byte authentication secret (base64url)
}

export interface PushSubscriptionTarget {
	endpoint: string;
	keys: PushSubscriptionKeys;
}

/**
 * Base64url encode an ArrayBuffer or Uint8Array
 */
export function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/**
 * Base64url decode a string into a Uint8Array
 */
export function base64UrlDecode(str: string): Uint8Array {
	let clean = str.trim().replace(/-/g, "+").replace(/_/g, "/");
	const pad = clean.length % 4;
	if (pad === 2) clean += "==";
	else if (pad === 3) clean += "=";
	else if (pad === 1) clean += "===";

	const binary = atob(clean);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Generate a new ECDSA P-256 key pair for VAPID
 */
export async function generateVapidKeys(): Promise<VapidKeys> {
	const keyPair = await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	);

	const rawPublic = await crypto.subtle.exportKey("raw", keyPair.publicKey);
	const jwk = (await crypto.subtle.exportKey("jwk", keyPair.privateKey)) as JsonWebKey;

	return {
		publicKey: base64UrlEncode(rawPublic),
		privateKey: jwk.d!,
	};
}

/**
 * Import a VAPID private key from base64url components or PKCS#8
 */
export async function importVapidPrivateKey(
	publicKey: string,
	privateKeyD: string,
): Promise<CryptoKey> {
	const cleanKey = privateKeyD.trim();
	// Check if key is PKCS#8 DER (standard from web-push or openssl)
	if (cleanKey.length > 60 || cleanKey.startsWith("MIGH")) {
		try {
			const pkcs8Bytes = base64UrlDecode(cleanKey);
			return await crypto.subtle.importKey(
				"pkcs8",
				pkcs8Bytes as unknown as BufferSource,
				{ name: "ECDSA", namedCurve: "P-256" },
				false,
				["sign"],
			);
		} catch {
			// Fall through to JWK format
		}
	}

	const rawPublic = base64UrlDecode(publicKey.trim());
	const x = base64UrlEncode(rawPublic.slice(1, 33));
	const y = base64UrlEncode(rawPublic.slice(33, 65));

	const jwk: JsonWebKey = {
		kty: "EC",
		crv: "P-256",
		x,
		y,
		d: cleanKey,
		ext: false,
	};

	return await crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
}

/**
 * Create RFC 8292 VAPID Authorization header (ES256 signed JWT)
 */
export async function createVapidAuthHeader(
	endpoint: string,
	subject: string,
	vapidKeys: VapidKeys,
): Promise<string> {
	const url = new URL(endpoint);
	const audience = url.origin;
	const expiry = Math.floor(Date.now() / 1000) + 12 * 3600; // 12 hours

	const header = {
		typ: "JWT",
		alg: "ES256",
	};

	const cleanSub = (subject || "").trim();
	const formattedSubject =
		cleanSub.startsWith("mailto:") || cleanSub.startsWith("https://") || cleanSub.startsWith("http://")
			? cleanSub
			: `mailto:${cleanSub || "support@reflect.cloud"}`;

	const claims = {
		aud: audience,
		exp: expiry,
		sub: formattedSubject,
	};

	const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
	const claimsB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(claims)));
	const unsignedToken = `${headerB64}.${claimsB64}`;

	const privateKey = await importVapidPrivateKey(vapidKeys.publicKey, vapidKeys.privateKey);
	const signatureBuffer = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		privateKey,
		new TextEncoder().encode(unsignedToken),
	);

	const signatureB64 = base64UrlEncode(signatureBuffer);
	const jwt = `${unsignedToken}.${signatureB64}`;

	return `vapid t=${jwt}, k=${vapidKeys.publicKey.trim()}`;
}

/**
 * Encrypt push message payload according to RFC 8291 (aes128gcm)
 */
export async function encryptPushPayload(
	subscriptionKeys: PushSubscriptionKeys,
	payload: string | Uint8Array,
): Promise<Uint8Array> {
	const clientPublicRaw = base64UrlDecode(subscriptionKeys.p256dh);
	const clientAuthSecret = base64UrlDecode(subscriptionKeys.auth);

	// Generate ephemeral ECDH P-256 key pair
	const serverEc = await crypto.subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveBits"],
	);
	const serverPublicRaw = new Uint8Array(
		await crypto.subtle.exportKey("raw", serverEc.publicKey),
	);

	// 16-byte random salt
	const salt = crypto.getRandomValues(new Uint8Array(16));

	// Server ECDH shared secret
	const clientKeyOnServer = await crypto.subtle.importKey(
		"raw",
		clientPublicRaw as unknown as BufferSource,
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		[],
	);
	const sharedSecret = await crypto.subtle.deriveBits(
		{ name: "ECDH", public: clientKeyOnServer },
		serverEc.privateKey,
		256,
	);

	// RFC 8291 Section 3.2: key_info = "WebPush: info\0" || receiver_public || sender_public
	const utf8Info = new TextEncoder().encode("WebPush: info\0");
	const keyInfo = new Uint8Array(utf8Info.length + clientPublicRaw.length + serverPublicRaw.length);
	keyInfo.set(utf8Info, 0);
	keyInfo.set(clientPublicRaw, utf8Info.length);
	keyInfo.set(serverPublicRaw, utf8Info.length + clientPublicRaw.length);

	const sharedSecretKey = await crypto.subtle.importKey(
		"raw",
		sharedSecret,
		"HKDF",
		false,
		["deriveBits"],
	);
	const ikm2 = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt: clientAuthSecret as unknown as BufferSource, info: keyInfo as unknown as BufferSource },
		sharedSecretKey,
		256,
	);

	// RFC 8291 Section 3.3: Content Encryption Key (CEK) & Nonce derivation
	const ikm2Key = await crypto.subtle.importKey(
		"raw",
		ikm2,
		"HKDF",
		false,
		["deriveBits"],
	);
	const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
	const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

	const cekBits = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt: salt, info: cekInfo },
		ikm2Key,
		128,
	);
	const nonceBits = await crypto.subtle.deriveBits(
		{ name: "HKDF", hash: "SHA-256", salt: salt, info: nonceInfo },
		ikm2Key,
		96,
	);

	// Payload formatting with delimiter 0x02 for single/last record (RFC 8188)
	const payloadBytes =
		typeof payload === "string" ? new TextEncoder().encode(payload) : payload;
	const record = new Uint8Array(payloadBytes.length + 1);
	record.set(payloadBytes, 0);
	record[payloadBytes.length] = 2;

	// AES-128-GCM encryption
	const cekKey = await crypto.subtle.importKey(
		"raw",
		cekBits,
		{ name: "AES-GCM" },
		false,
		["encrypt"],
	);
	const ciphertext = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: new Uint8Array(nonceBits) },
		cekKey,
		record,
	);

	// RFC 8188 Header (86 bytes total):
	// - salt: 16 bytes
	// - rs (record size): 4 bytes big-endian (4096 = 0x00001000)
	// - idlen: 1 byte (65 = 0x41)
	// - keyid: 65 bytes (server public key)
	const recordSize = 4096;
	const header = new Uint8Array(16 + 4 + 1 + serverPublicRaw.length);
	header.set(salt, 0);
	const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
	view.setUint32(16, recordSize, false);
	header[20] = serverPublicRaw.length;
	header.set(serverPublicRaw, 21);

	// Assemble final body: header + encrypted record (including 16-byte GCM tag)
	const body = new Uint8Array(header.length + ciphertext.byteLength);
	body.set(header, 0);
	body.set(new Uint8Array(ciphertext), header.length);

	return body;
}

/**
 * Send an encrypted Web Push notification to a subscription endpoint
 */
export async function sendWebPush(
	subscription: PushSubscriptionTarget,
	payload: string | object,
	vapidKeys: VapidKeys,
	subject: string = "mailto:support@reflect.cloud",
): Promise<{ success: boolean; statusCode: number; error?: string }> {
	try {
		const payloadString =
			typeof payload === "object" ? JSON.stringify(payload) : payload;
		const encryptedBody = await encryptPushPayload(subscription.keys, payloadString);
		const authHeader = await createVapidAuthHeader(
			subscription.endpoint,
			subject,
			vapidKeys,
		);

		const response = await fetch(subscription.endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/octet-stream",
				"Content-Encoding": "aes128gcm",
				TTL: "86400",
				Urgency: "high",
				Authorization: authHeader,
			},
			body: encryptedBody as any,
		});

		if (response.ok || response.status === 201) {
			return { success: true, statusCode: response.status };
		}

		const errorText = await response.text();
		return {
			success: false,
			statusCode: response.status,
			error: errorText,
		};
	} catch (err: any) {
		return {
			success: false,
			statusCode: 500,
			error: err?.message || String(err),
		};
	}
}

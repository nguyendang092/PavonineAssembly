import { ImageUploadError } from "./errors.mjs";

function getFirebaseApiKey() {
  return String(
    process.env.FIREBASE_API_KEY ??
      process.env.VITE_FIREBASE_API_KEY ??
      "",
  ).trim();
}

function isAuthSkipped() {
  return String(process.env.IMAGE_UPLOAD_SKIP_AUTH ?? "") === "1";
}

/**
 * Xác thực Firebase ID token qua Identity Toolkit (không cần firebase-admin).
 * @returns {Promise<{ uid: string, email?: string }>}
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken) {
    throw new ImageUploadError("AUTH_REQUIRED");
  }

  if (isAuthSkipped()) {
    return { uid: "dev-bypass", email: "dev@local" };
  }

  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    throw new ImageUploadError("SERVER_MISCONFIGURED");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );

  let json;
  try {
    json = await res.json();
  } catch {
    throw new ImageUploadError("AUTH_INVALID");
  }

  const user = json?.users?.[0];
  if (!res.ok || !user?.localId) {
    throw new ImageUploadError("AUTH_INVALID");
  }

  return {
    uid: String(user.localId),
    email: user.email ? String(user.email) : undefined,
  };
}

import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export interface UserAccount {
  email: string;
  name: string;
  role: string;
  avatarColor: string;
  uid?: string;
  provider?: "firebase" | "local";
}

export const HARDCODED_ADMIN_USERS: Record<string, { user: UserAccount; pass: string }> = {
  "admin@apex.com": {
    user: {
      email: "admin@apex.com",
      name: "Dilshan Mindika",
      role: "Lead IT Administrator",
      avatarColor: "bg-blue-600",
    },
    pass: "admin123",
  },
  "sysadmin@apex.com": {
    user: {
      email: "sysadmin@apex.com",
      name: "Kasun Perera",
      role: "System Administrator",
      avatarColor: "bg-indigo-600",
    },
    pass: "sysadmin123",
  },
  "security@apex.com": {
    user: {
      email: "security@apex.com",
      name: "Nuwan Fernando",
      role: "Security Operations",
      avatarColor: "bg-rose-600",
    },
    pass: "security123",
  },
  "manager@apex.com": {
    user: {
      email: "manager@apex.com",
      name: "Chamari Silva",
      role: "IT Fleet Manager",
      avatarColor: "bg-amber-600",
    },
    pass: "manager123",
  },
  "support@apex.com": {
    user: {
      email: "support@apex.com",
      name: "Pathum Jayawardena",
      role: "IT Helpdesk Specialist",
      avatarColor: "bg-emerald-600",
    },
    pass: "support123",
  },
};

/**
 * Synchronous local credential authenticator fallback.
 */
export function authenticateUser(email: string, pass: string): UserAccount | null {
  const account = HARDCODED_ADMIN_USERS[email.trim().toLowerCase()];
  if (account && account.pass === pass.trim()) {
    return { ...account.user, provider: "local" };
  }
  return null;
}

/**
 * Helper to sync user profile to Firestore `users` collection silently on login.
 */
async function syncUserProfileToFirestore(user: UserAccount, uid: string) {
  try {
    const docId = user.email.toLowerCase().replace("@", "_at_").replace(".", "_dot_");
    await setDoc(
      doc(db, "users", docId),
      {
        uid,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarColor: user.avatarColor,
        status: "active",
        last_login: serverTimestamp()
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Firestore user profile sync note:", err);
  }
}

/**
 * Asynchronous Firebase Authentication with automatic credential provisioning & Firestore user sync.
 */
export async function authenticateUserWithFirebase(
  email: string,
  pass: string
): Promise<UserAccount | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const matchedAdmin = HARDCODED_ADMIN_USERS[normalizedEmail];

  try {
    // 1. Attempt standard Firebase Auth sign-in
    let uid = "";
    try {
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, pass.trim());
      uid = userCredential.user.uid;
    } catch (authErr: any) {
      if (authErr?.code === "auth/user-not-found" || authErr?.code === "auth/invalid-credential") {
        // Auto-create user account in Firebase Auth
        const newCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, pass.trim());
        uid = newCredential.user.uid;
      } else {
        throw authErr;
      }
    }

    const userProfile: UserAccount = {
      email: normalizedEmail,
      name: matchedAdmin?.user.name || normalizedEmail.split("@")[0],
      role: matchedAdmin?.user.role || "Enterprise Administrator",
      avatarColor: matchedAdmin?.user.avatarColor || "bg-blue-600",
      uid,
      provider: "firebase"
    };

    // Silently seed/sync profile to Firestore `users` collection
    syncUserProfileToFirestore(userProfile, uid);

    return userProfile;
  } catch (err: any) {
    console.warn("Firebase Auth fallback to local admin profile:", err?.message || err);

    // 2. Fallback to hardcoded admin account if network or rule issue occurs
    const localUser = authenticateUser(email, pass);
    if (localUser) {
      return localUser;
    }

    return null;
  }
}

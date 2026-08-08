import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBtlciNYhSGiAO4npSIaSJYpocEAtPzO5w",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "apex-ml-4b1d9.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "apex-ml-4b1d9",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "apex-ml-4b1d9.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "633780934728",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:633780934728:web:53526501757ed9b69d607d",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CEXBGYSTZP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SEED_ADMIN_ACCOUNTS = [
  {
    email: "admin@apex.com",
    pass: "admin123",
    name: "Dilshan Mindika",
    role: "Lead IT Administrator",
    avatarColor: "bg-blue-600",
  },
  {
    email: "sysadmin@apex.com",
    pass: "sysadmin123",
    name: "Kasun Perera",
    role: "System Administrator",
    avatarColor: "bg-indigo-600",
  },
  {
    email: "security@apex.com",
    pass: "security123",
    name: "Nuwan Fernando",
    role: "Security Operations",
    avatarColor: "bg-rose-600",
  },
  {
    email: "manager@apex.com",
    pass: "manager123",
    name: "Chamari Silva",
    role: "IT Fleet Manager",
    avatarColor: "bg-amber-600",
  },
  {
    email: "support@apex.com",
    pass: "support123",
    name: "Pathum Jayawardena",
    role: "IT Helpdesk Specialist",
    avatarColor: "bg-emerald-600",
  },
];

const INITIAL_FLEET_DEVICES = [];

async function runSeed() {
  console.log("=================================================");
  console.log("  ApexPulse Firebase Node.js Production Seeder   ");
  console.log("=================================================\n");

  for (const acc of SEED_ADMIN_ACCOUNTS) {
    let uid = "";
    try {
      const cred = await createUserWithEmailAndPassword(auth, acc.email, acc.pass);
      uid = cred.user.uid;
      console.log(`[+] Created Firebase Auth User: ${acc.email} (${acc.role})`);
    } catch (err) {
      if (err?.code === "auth/email-already-in-use") {
        try {
          const loginCred = await signInWithEmailAndPassword(auth, acc.email, acc.pass);
          uid = loginCred.user.uid;
          console.log(`[i] User already exists in Auth: ${acc.email}`);
        } catch (lErr) {
          console.log(`[i] User exists in Auth: ${acc.email}`);
        }
      } else {
        console.error(`[!] Auth notice for ${acc.email}:`, err?.message || err);
      }
    }

    const docId = acc.email.toLowerCase().replace("@", "_at_").replace(".", "_dot_");
    await setDoc(
      doc(db, "users", docId),
      {
        uid: uid || docId,
        email: acc.email,
        name: acc.name,
        role: acc.role,
        avatarColor: acc.avatarColor,
        status: "active",
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`[+] Seeded Firestore User Document: users/${docId}`);
  }

  for (const dev of INITIAL_FLEET_DEVICES) {
    await setDoc(
      doc(db, "devices", dev.device_id),
      {
        ...dev,
        last_seen: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log(`[+] Seeded Firestore Device Document: devices/${dev.device_id}`);

    await addDoc(collection(db, "telemetry_history"), {
      device_id: dev.device_id,
      device_name: dev.device_name,
      device_model: dev.device_model,
      cpu_usage: 22.4,
      ram_usage: 48.0,
      disk_usage: 42.5,
      battery_health: dev.battery_health,
      ssd_health: dev.ssd_health,
      temperature_current: 46.0,
      edhi: dev.edhi,
      rul_months: dev.rul_months,
      recommendation: dev.recommendation,
      status_level: dev.status_level,
      timestamp: new Date().toISOString(),
    });
  }
  console.log(`[+] Seeded initial telemetry history snapshots.`);

  await setDoc(
    doc(db, "fleet_summary", "overview"),
    {
      total_devices: INITIAL_FLEET_DEVICES.length,
      healthy_count: 2,
      monitor_count: 1,
      replacement_count: 1,
      avg_rul_months: 33.9,
      avg_edhi: 87.2,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
  console.log(`[+] Seeded fleet summary overview.`);

  console.log("\n=================================================");
  console.log("  SUCCESS! Node.js Firebase Seeding Complete!    ");
  console.log("=================================================");
  process.exit(0);
}

runSeed().catch((err) => {
  console.error("Seeder failed:", err);
  process.exit(1);
});

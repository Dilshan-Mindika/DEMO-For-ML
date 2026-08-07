import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

export const SEED_ADMIN_ACCOUNTS = [
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

export const INITIAL_FLEET_DEVICES = [
  {
    device_id: "dell-xps-15-sn892301",
    device_name: "Dilshan-XPS-15",
    device_model: "Dell XPS 15 9520",
    manufacturer: "Dell Inc.",
    os_name: "Windows",
    os_version: "11 Pro 23H2",
    serial_number: "SN-892301-XPS",
    assigned_user: "Dilshan Mindika",
    battery_health: 92.5,
    ssd_health: 98.0,
    edhi: 94.2,
    rul_months: 41.5,
    recommendation: "Healthy Device",
    status_level: "healthy",
    status_color: "#10B981",
  },
  {
    device_id: "lenovo-thinkpad-x1-sn771239",
    device_name: "Kasun-ThinkPad-X1",
    device_model: "Lenovo ThinkPad X1 Carbon Gen 10",
    manufacturer: "Lenovo",
    os_name: "Windows",
    os_version: "11 Pro 23H2",
    serial_number: "SN-771239-LNV",
    assigned_user: "Kasun Perera",
    battery_health: 84.0,
    ssd_health: 91.0,
    edhi: 86.0,
    rul_months: 29.8,
    recommendation: "Monitor Device",
    status_level: "monitor",
    status_color: "#3B82F6",
  },
  {
    device_id: "hp-elitebook-840-sn449120",
    device_name: "Nuwan-EliteBook",
    device_model: "HP EliteBook 840 G8",
    manufacturer: "HP",
    os_name: "Windows",
    os_version: "11 Enterprise",
    serial_number: "SN-449120-HP",
    assigned_user: "Nuwan Fernando",
    battery_health: 64.5,
    ssd_health: 88.0,
    edhi: 71.0,
    rul_months: 18.2,
    recommendation: "Plan Replacement",
    status_level: "plan_replacement",
    status_color: "#F59E0B",
  },
  {
    device_id: "macbook-pro-16-sn102938",
    device_name: "Chamari-MacBook-Pro",
    device_model: "Apple MacBook Pro 16 (M2 Max)",
    manufacturer: "Apple Inc.",
    os_name: "macOS",
    os_version: "Sonoma 14.5",
    serial_number: "SN-102938-APL",
    assigned_user: "Chamari Silva",
    battery_health: 96.0,
    ssd_health: 99.0,
    edhi: 97.5,
    rul_months: 46.0,
    recommendation: "Healthy Device",
    status_level: "healthy",
    status_color: "#10B981",
  },
];

export interface SeedResult {
  success: boolean;
  usersCreated: number;
  devicesSeeded: number;
  telemetryLogsSeeded: number;
  logs: string[];
}

/**
 * Seeds Firebase Authentication accounts and populates production Firestore database collections.
 */
export async function seedFirebaseProductionDatabase(
  logCallback?: (msg: string) => void
): Promise<SeedResult> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    if (logCallback) logCallback(msg);
    console.log(`[Firebase Seeder] ${msg}`);
  };

  let usersCreated = 0;
  let devicesSeeded = 0;
  let telemetryLogsSeeded = 0;

  try {
    log("🌱 Initializing Firebase Production Database Seeding...");

    // 1. Seed Enterprise Admin Accounts into Firebase Auth & Firestore `users` collection
    for (const acc of SEED_ADMIN_ACCOUNTS) {
      let uid = "";
      try {
        const cred = await createUserWithEmailAndPassword(auth, acc.email, acc.pass);
        uid = cred.user.uid;
        log(`✓ Created Firebase Auth Account: ${acc.email} (${acc.role})`);
        usersCreated++;
      } catch (authErr: any) {
        if (authErr?.code === "auth/email-already-in-use") {
          try {
            const loginCred = await signInWithEmailAndPassword(auth, acc.email, acc.pass);
            uid = loginCred.user.uid;
            log(`ℹ Auth account exists: ${acc.email} (logged in)`);
          } catch (loginErr) {
            log(`⚠ Account exists: ${acc.email}`);
          }
        } else {
          log(`⚠ Auth account notice for ${acc.email}: ${authErr?.message || authErr}`);
        }
      }

      // Write User Profile Document into Firestore `users` collection
      const userDocId = acc.email.toLowerCase().replace("@", "_at_").replace(".", "_dot_");
      await setDoc(
        doc(db, "users", userDocId),
        {
          uid: uid || userDocId,
          email: acc.email,
          name: acc.name,
          role: acc.role,
          avatarColor: acc.avatarColor,
          status: "active",
          updated_at: serverTimestamp(),
          created_at: serverTimestamp(),
        },
        { merge: true }
      );
      log(`✓ Seeded Firestore User Profile: ${acc.name} (${acc.role})`);
    }

    // 2. Seed Fleet Laptops into Firestore `devices` collection
    for (const dev of INITIAL_FLEET_DEVICES) {
      await setDoc(
        doc(db, "devices", dev.device_id),
        {
          ...dev,
          last_seen: new Date().toISOString(),
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );
      devicesSeeded++;
      log(`✓ Seeded Firestore Device Record: ${dev.device_name} (${dev.device_model})`);

      // Seed sample initial telemetry snapshot into Firestore `telemetry_history`
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
        created_at: serverTimestamp(),
      });
      telemetryLogsSeeded++;
    }

    // 3. Seed Initial Maintenance Log Entry into Firestore `maintenance_logs`
    await addDoc(collection(db, "maintenance_logs"), {
      device_id: "hp-elitebook-840-sn449120",
      action: "replace_battery",
      rul_months: 32.5,
      recommendation: "Monitor Device",
      status_level: "monitor",
      edhi: 86.0,
      timestamp: new Date().toISOString(),
      created_at: serverTimestamp(),
    });
    log(`✓ Seeded Firestore Maintenance Audit Log entry`);

    // 4. Seed Fleet Summary Analytics Snapshot into `fleet_summary`
    await setDoc(
      doc(db, "fleet_summary", "overview"),
      {
        total_devices: INITIAL_FLEET_DEVICES.length,
        healthy_count: 2,
        monitor_count: 1,
        replacement_count: 1,
        avg_rul_months: 33.9,
        avg_edhi: 87.2,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
    log(`✓ Seeded Firestore Fleet Summary Snapshot`);

    log("🎉 SUCCESS! Firebase Authentication & Firestore Database fully seeded for Production!");
    return {
      success: true,
      usersCreated,
      devicesSeeded,
      telemetryLogsSeeded,
      logs,
    };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    log(`❌ Seeding Error: ${errMsg}`);
    return {
      success: false,
      usersCreated,
      devicesSeeded,
      telemetryLogsSeeded,
      logs,
    };
  }
}

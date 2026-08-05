export interface UserAccount {
  email: string;
  name: string;
  role: string;
  avatarColor: string;
}

export const HARDCODED_ADMIN_USERS: Record<string, { user: UserAccount; pass: string }> = {
  "admin@apex.com": {
    user: {
      email: "admin@apex.com",
      name: "Alex Mercer",
      role: "Lead IT Administrator",
      avatarColor: "bg-blue-600",
    },
    pass: "admin123",
  },
  "sysadmin@apex.com": {
    user: {
      email: "sysadmin@apex.com",
      name: "Sarah Chen",
      role: "System Administrator",
      avatarColor: "bg-indigo-600",
    },
    pass: "sysadmin123",
  },
  "security@apex.com": {
    user: {
      email: "security@apex.com",
      name: "Marcus Vance",
      role: "Security Operations",
      avatarColor: "bg-rose-600",
    },
    pass: "security123",
  },
  "manager@apex.com": {
    user: {
      email: "manager@apex.com",
      name: "Elena Rostova",
      role: "IT Fleet Manager",
      avatarColor: "bg-amber-600",
    },
    pass: "manager123",
  },
  "support@apex.com": {
    user: {
      email: "support@apex.com",
      name: "David Kim",
      role: "IT Helpdesk Specialist",
      avatarColor: "bg-emerald-600",
    },
    pass: "support123",
  },
};

export function authenticateUser(email: string, pass: string): UserAccount | null {
  const account = HARDCODED_ADMIN_USERS[email.trim().toLowerCase()];
  if (account && account.pass === pass.trim()) {
    return account.user;
  }
  return null;
}

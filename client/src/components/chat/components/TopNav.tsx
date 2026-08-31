"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "../Icon";
import { getToken } from "@/lib/api";
import type { User } from "@/lib/api";
import styles from "../chat-workspace.module.css";

type Props = {
  docName: string;
  docId: string | null;
  onNewChat: () => void;
  user: User | null;
  authenticated: boolean;
  onLogout: () => void;
};

function initials(user: User | null): string {
  if (!user) return "AS";
  const first = user.firstName?.[0] ?? "";
  const last = user.lastName?.[0] ?? "";
  return (first + last || user.email?.[0] || "?").toUpperCase();
}

export default function TopNav({ docName, docId, onNewChat, user, authenticated, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);

  const name =
    user && (user.firstName || user.lastName)
      ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
      : user?.email || "Account";

  const openPdf = async () => {
    if (!docId || opening) return;
    setOpening(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/documents/${docId}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error(err);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className={styles.topnav}>
      <div className={styles.logo}>
        docu<span>.</span>mind
      </div>
      <button
        type="button"
        className={styles.docPill}
        onClick={openPdf}
        disabled={!docId || opening}
        title={docId ? `Open ${docName}` : undefined}
      >
        <Icon name="pdf" size={15} />
        <span>{docName}</span>
      </button>
      <div className={styles.navSpacer} />
      <div className={styles.navAct}>
        <button className={`${styles.nbtn} ${styles.nbtnRose}`} onClick={onNewChat}>
          <Icon name="plus" size={15} />
          New chat
        </button>
        {authenticated ? (
          <div className={styles.profileWrap}>
            <button
              className={styles.uav}
              title="Account"
              onClick={() => setOpen((prev) => !prev)}
            >
              {initials(user)}
            </button>
            {open && (
              <div className={styles.profileMenu}>
                <div className={styles.profileHead}>
                  <div className={styles.profileName}>{name}</div>
                  {user?.email && (
                    <div className={styles.profileEmail}>{user.email}</div>
                  )}
                </div>
                <button
                  className={styles.profileLogout}
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                >
                  <Icon name="logout" size={15} />
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link className={`${styles.nbtn} ${styles.nbtnRose} ${styles.nbtnLink}`} href="/login">
            Log in
          </Link>
        )}
      </div>
    </div>
  );
}
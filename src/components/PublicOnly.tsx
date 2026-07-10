"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

type PublicOnlyProps = {
  children: ReactNode;
};

export default function PublicOnly({ children }: PublicOnlyProps) {
  const supabase = useMemo(() => createClient(), []);
  const [showPublicContent, setShowPublicContent] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      setShowPublicContent(!data.session?.user);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        setShowPublicContent(!nextSession?.user);
      },
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (!showPublicContent) {
    return null;
  }

  return <>{children}</>;
}

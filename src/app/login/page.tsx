"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import Link from "next/link";
import type {
  AuthChangeEvent,
  Session,
  User,
} from "@supabase/supabase-js";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/client";
import {
  getOrCreateDeviceId,
  loadRegisteredDevices,
  removeRegisteredDevice,
  type DeviceAccessResponse,
} from "@/services/deviceAccess";
import {
  PLAN_CONFIG,
  normalizeUserPlan,
  type UserPlan,
} from "@/config/plans";
import { fetchJsonWithTimeout } from "@/utils/clientApi";
import {
  clearLocalWorkshopProfileState,
  convertProfileToDemoAccount,
  deleteWorkshopProfileFromSupabase,
  loadWorkshopProfileFromSupabase,
  notifyWorkshopProfileChanged,
  readLocalDemoAccount,
  saveWorkshopProfileToSupabase,
  syncWorkshopProfileToLocalStorage,
  type DemoAccount,
  type WorkshopProfileDatabaseRow,
} from "@/services/workshopProfileSupabase";

const DEFAULT_ROLE = "Privatnutzer";
type SafetyAccountType = "private" | "mechanic" | "workshop";
type SafetyRole =
  | "private"
  | "azubi"
  | "geselle"
  | "meister"
  | "inhaber"
  | "serviceberater"
  | "sonstige";
type HvQualification = "none" | "hv1" | "hv2" | "hv3" | "other";
type RiskAccessLevel = "green" | "yellow" | "orange" | "red" | "hv";
type QualificationLevel =
  | "none"
  | "self_declared"
  | "verified_workshop"
  | "hv_verified";
type HvRequestStatus = "pending" | "approved" | "rejected";

type SafetyProfileState = {
  accountType: SafetyAccountType | "admin";
  role: string;
  qualificationLevel: QualificationLevel;
  companyVerified: boolean;
  hvVerified: boolean;
  hvQualification: HvQualification;
  riskAccessLevel: RiskAccessLevel;
  termsSafetyAcceptedAt: string | null;
};

type SafetySettingsState = {
  accountType: SafetyAccountType;
  role: SafetyRole;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyWebsite: string;
  companyVerified: boolean;
  hvQualification: HvQualification;
  hvCertificateUrl: string;
  hvTrainingProvider: string;
  hvTrainingDate: string;
  hvCertificateName: string;
  hvVerified: boolean;
  termsSafetyAcceptedAt: string | null;
  riskAccessLevel: RiskAccessLevel;
};

type HvAccessRequest = {
  id: string;
  status: HvRequestStatus;
  hv_qualification: HvQualification;
  training_provider?: string | null;
  training_date?: string | null;
  certificate_name?: string | null;
  company_name?: string | null;
  review_comment?: string | null;
  created_at: string;
  reviewed_at?: string | null;
};

const safetyAccountTypeLabels: Record<SafetyAccountType | "admin", string> = {
  private: "Privatnutzer",
  mechanic: "Mechaniker",
  workshop: "Werkstatt",
  admin: "Admin",
};

const safetyRoleLabels: Record<SafetyRole, string> = {
  private: "Privatnutzer",
  azubi: "Azubi",
  geselle: "Geselle",
  meister: "Meister",
  inhaber: "Inhaber",
  serviceberater: "Serviceberater",
  sonstige: "Sonstige",
};

const qualificationLabels: Record<QualificationLevel, string> = {
  none: "Keine Prüfung",
  self_declared: "Selbst angegeben",
  verified_workshop: "Werkstatt geprüft",
  hv_verified: "Hochvolt geprüft",
};

const hvQualificationLabels: Record<HvQualification, string> = {
  none: "Keine",
  hv1: "HV 1",
  hv2: "HV 2",
  hv3: "HV 3",
  other: "Andere HV-Qualifikation",
};

const hvRequestStatusLabels: Record<HvRequestStatus, string> = {
  pending: "Prüfung offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

const riskAccessLabels: Record<RiskAccessLevel, string> = {
  green: "Basis",
  yellow: "Gelb",
  orange: "Orange",
  red: "Rot",
  hv: "Hochvolt",
};

const defaultSafetySettings: SafetySettingsState = {
  accountType: "private",
  role: "private",
  companyName: "",
  companyAddress: "",
  companyPhone: "",
  companyWebsite: "",
  companyVerified: false,
  hvQualification: "none",
  hvCertificateUrl: "",
  hvTrainingProvider: "",
  hvTrainingDate: "",
  hvCertificateName: "",
  hvVerified: false,
  termsSafetyAcceptedAt: null,
  riskAccessLevel: "yellow",
};

const setupSteps = [
  {
    title: "1. Account",
    description: "Registrieren oder einloggen.",
  },
  {
    title: "2. Profil",
    description: "Name und optional Betrieb speichern.",
  },
  {
    title: "3. Start",
    description: "Diagnose, Lernen oder Service nutzen.",
  },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unbekannter Fehler";
}

function getFriendlyAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("rate limit")) {
    return "Zu viele Registrierungs- oder E-Mail-Versuche in kurzer Zeit. Bitte warte ein paar Minuten und versuche es dann erneut.";
  }

  if (
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists") ||
    normalizedMessage.includes("user already")
  ) {
    return "Diese E-Mail ist bereits registriert. Bitte nutze den Login oder setze das Passwort zurück.";
  }

  if (
    normalizedMessage.includes("invalid login credentials") ||
    normalizedMessage.includes("invalid credentials")
  ) {
    return "E-Mail oder Passwort stimmt nicht. Bitte prüfe die Eingabe oder setze das Passwort zurück.";
  }

  return message;
}

function getSafePlanConfig(plan: unknown) {
  return PLAN_CONFIG[normalizeUserPlan(plan)];
}

function normalizeSafetyAccountType(value: unknown): SafetyAccountType {
  if (value === "mechanic" || value === "workshop") {
    return value;
  }

  return "private";
}

function normalizeSafetyRole(value: unknown): SafetyRole {
  if (
    value === "private" ||
    value === "azubi" ||
    value === "geselle" ||
    value === "meister" ||
    value === "inhaber" ||
    value === "serviceberater" ||
    value === "sonstige"
  ) {
    return value;
  }

  const textValue = typeof value === "string" ? value.toLowerCase() : "";

  if (textValue.includes("azubi")) return "azubi";
  if (textValue.includes("geselle") || textValue.includes("mechaniker")) {
    return "geselle";
  }
  if (textValue.includes("meister")) return "meister";
  if (textValue.includes("inhaber") || textValue.includes("werkstatt")) {
    return "inhaber";
  }
  if (textValue.includes("service")) return "serviceberater";

  return "private";
}

function normalizeHvQualification(value: unknown): HvQualification {
  if (value === "hv1" || value === "hv2" || value === "hv3" || value === "other") {
    return value;
  }

  return "none";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  let timeoutId: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} dauerte zu lange.`));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }),
    timeoutPromise,
  ]);
}

function scheduleProfileScroll(profileSectionRef: RefObject<HTMLDivElement | null>) {
  window.setTimeout(() => {
    profileSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 120);
}

function isPlaceholderProfileName(name: string, email?: string | null) {
  const cleanName = name.trim().toLowerCase();
  const emailPrefix = email?.split("@")[0]?.trim().toLowerCase() || "";

  return (
    !cleanName ||
    cleanName === "diagnosehub nutzer" ||
    cleanName === "nicht hinterlegt" ||
    cleanName === "profil noch nicht gespeichert" ||
    Boolean(emailPrefix && cleanName === emailPrefix)
  );
}

function isPlaceholderWorkshopName(workshopName: string) {
  const cleanWorkshopName = workshopName.trim().toLowerCase();

  return (
    !cleanWorkshopName ||
    cleanWorkshopName === "nicht angegeben" ||
    cleanWorkshopName === "profil noch nicht gespeichert"
  );
}

function needsWorkshopProfileSetup(
  profile: WorkshopProfileDatabaseRow | null,
  currentUser?: User | null
) {
  if (!profile) {
    return true;
  }

  return (
    isPlaceholderProfileName(profile.full_name, profile.email || currentUser?.email) ||
    !profile.email ||
    !profile.email.includes("@")
  );
}

function isEnterNavigationInput(
  target: EventTarget | null
): target is HTMLInputElement {
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  return ![
    "button",
    "checkbox",
    "file",
    "hidden",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(target.type);
}

function isFocusableEnterTarget(element: HTMLElement) {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLButtonElement
  ) {
    return !element.disabled;
  }

  return true;
}

function focusEnterTarget(element: HTMLElement) {
  element.focus();

  if (element instanceof HTMLInputElement && element.type !== "date") {
    element.select();
  }
}

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const profileSectionRef = useRef<HTMLDivElement | null>(null);
  const profileNameInputRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<User | null>(null);

  const [authMode, setAuthMode] = useState<"login" | "register" | "reset">(
    "login"
  );
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [profileGuidance, setProfileGuidance] = useState("");

  const [name, setName] = useState("");
  const [workshop, setWorkshop] = useState("");
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [plan, setPlan] = useState<UserPlan>("free");
  const [savedAccount, setSavedAccount] = useState<DemoAccount | null>(null);
  const [databaseProfile, setDatabaseProfile] =
    useState<WorkshopProfileDatabaseRow | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [deviceAccess, setDeviceAccess] = useState<DeviceAccessResponse | null>(
    null
  );
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [safetyProfile, setSafetyProfile] =
    useState<SafetyProfileState | null>(null);
  const [safetySettings, setSafetySettings] =
    useState<SafetySettingsState>(defaultSafetySettings);
  const [hvAccessRequests, setHvAccessRequests] = useState<HvAccessRequest[]>(
    []
  );
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [hvRequestLoading, setHvRequestLoading] = useState(false);
  const [safetyTermsAccepted, setSafetyTermsAccepted] = useState(false);
  const [hvSafetyConfirmation, setHvSafetyConfirmation] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const accountStatus = useMemo(() => {
    if (!user) {
      return "Nicht eingeloggt";
    }

    if (!databaseProfile && !savedAccount) {
      return "Eingeloggt, aber Nutzerprofil fehlt";
    }

    if (!savedAccount) {
      return "Nutzerprofil vorhanden";
    }

    return `${savedAccount.workshop} · ${getSafePlanConfig(
      savedAccount.plan
    ).label}`;
  }, [databaseProfile, savedAccount, user]);

  function handleEnterToNextField(event: ReactKeyboardEvent<HTMLElement>) {
    if (
      event.key !== "Enter" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      !isEnterNavigationInput(event.target)
    ) {
      return;
    }

    const currentElement = event.target;
    const scope = currentElement.closest("[data-enter-scope]") as HTMLElement | null;

    if (!scope) {
      return;
    }

    const targets = Array.from(
      scope.querySelectorAll<HTMLElement>("[data-enter-next]")
    ).filter(isFocusableEnterTarget);
    const currentIndex = targets.findIndex((target) => target === currentElement);
    const nextTarget = currentIndex >= 0 ? targets[currentIndex + 1] : null;

    event.preventDefault();

    if (nextTarget) {
      focusEnterTarget(nextTarget);
      return;
    }

    const fallbackTargetId = scope.dataset.enterSubmitTarget;
    const fallbackTarget = fallbackTargetId
      ? document.getElementById(fallbackTargetId)
      : null;

    if (fallbackTarget) {
      focusEnterTarget(fallbackTarget);
    }
  }

  function prepareProfileFieldsForSetup(
    profile: WorkshopProfileDatabaseRow | null,
    currentUser?: User | null
  ) {
    if (!profile) {
      setDatabaseProfile(null);
      setSavedAccount(null);
      setName("");
      setWorkshop("");
      setRole(DEFAULT_ROLE);
      setPlan("free");
      return;
    }

    setName(
      isPlaceholderProfileName(profile.full_name, profile.email || currentUser?.email)
        ? ""
        : profile.full_name
    );
    setWorkshop(
      isPlaceholderWorkshopName(profile.workshop_name)
        ? ""
        : profile.workshop_name
    );
    setRole(profile.role || DEFAULT_ROLE);
    setPlan(normalizeUserPlan(profile.plan || "free"));
  }

  function openRequiredProfileSetup(
    profile: WorkshopProfileDatabaseRow | null,
    currentUser: User | null,
    message: string
  ) {
    prepareProfileFieldsForSetup(profile, currentUser);
    openProfileSetup(message);
  }

  useEffect(() => {
    loadLocalAccount();

    async function loadSession() {
      const searchParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      const shouldOpenProfile = searchParams?.get("setup") === "profile";
      const accountStatus = searchParams?.get("account") || "";
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setAuthError(getFriendlyAuthError(error.message));
        return;
      }

      setUser(data.session?.user ?? null);

      if (!data.session && accountStatus === "deleted") {
        setAuthMessage(
          "Dein Account wurde gelöscht. Ein vorhandenes Stripe-Abo wurde vorher gekündigt."
        );
      }

      if (data.session?.user?.email) {
        setAuthEmail(data.session.user.email);
      }

      if (data.session?.user) {
        const profile = await loadWorkshopProfile(data.session.user);
        await loadDeviceAccess(data.session);
        await loadSafetyProfile(data.session);

        if (shouldOpenProfile || needsWorkshopProfileSetup(profile, data.session.user)) {
          if (needsWorkshopProfileSetup(profile, data.session.user)) {
            openRequiredProfileSetup(
              profile,
              data.session.user,
              "Erstelle jetzt dein Nutzerprofil. Danach kannst du DiagnoseHUB sauber nutzen."
            );
          } else {
            openProfileSetup(
              "Prüfe kurz dein Nutzerprofil und passe es bei Bedarf an."
            );
          }
        }
      }
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, nextSession: Session | null) => {
        setUser(nextSession?.user ?? null);

        if (nextSession?.user?.email) {
          setAuthEmail(nextSession.user.email);
        }

        if (!nextSession?.user) {
          setDatabaseProfile(null);
          setSavedAccount(null);
          setDeviceAccess(null);
          setSafetyProfile(null);
          setSafetySettings(defaultSafetySettings);
          setHvAccessRequests([]);
          setSafetyTermsAccepted(false);
          setHvSafetyConfirmation(false);
          setName("");
          setWorkshop("");
          setRole(DEFAULT_ROLE);
          setPlan("free");
          return;
        }

        window.setTimeout(() => {
          void (async () => {
            const profile = await loadWorkshopProfile(nextSession.user);
            await loadDeviceAccess(nextSession);
            await loadSafetyProfile(nextSession);

            if (needsWorkshopProfileSetup(profile, nextSession.user)) {
              openRequiredProfileSetup(
                profile,
                nextSession.user,
                "Erstelle jetzt dein Nutzerprofil. Danach sind Dashboard, Diagnose und Service sauber mit deinem Account verbunden."
              );
            }
          })();
        }, 0);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function loadLocalAccount() {
    const localAccount = readLocalDemoAccount();

    if (!localAccount) {
      return;
    }

    setSavedAccount(localAccount);
    setName(localAccount.name || "");
    setWorkshop(localAccount.workshop || "");
    setRole(localAccount.role || DEFAULT_ROLE);
    setPlan(normalizeUserPlan(localAccount.plan || "free"));
  }

  async function loadDeviceAccess(existingSession?: Session | null) {
    setDeviceLoading(true);

    try {
      const session =
        existingSession ??
        (await supabase.auth.getSession()).data.session ??
        null;

      if (!session?.access_token) {
        setDeviceAccess(null);
        return;
      }

      getOrCreateDeviceId();
      const access = await withTimeout(
        loadRegisteredDevices(session.access_token),
        9000,
        "Geräteprüfung"
      );
      setDeviceAccess(access);
    } catch (error) {
      console.error("Gerätezugriff konnte nicht geladen werden:", error);
      setDeviceAccess(null);
    } finally {
      setDeviceLoading(false);
    }
  }

  function applySafetyState(
    profile?: SafetyProfileState | null,
    settings?: Partial<SafetySettingsState> | null,
    requests?: HvAccessRequest[]
  ) {
    const nextSettings = {
      ...defaultSafetySettings,
      ...settings,
      accountType: normalizeSafetyAccountType(settings?.accountType),
      role: normalizeSafetyRole(settings?.role),
      hvQualification: normalizeHvQualification(settings?.hvQualification),
      companyName:
        settings?.companyName ||
        workshop.trim() ||
        databaseProfile?.workshop_name ||
        "",
    };

    setSafetyProfile(profile ?? null);
    setSafetySettings(nextSettings);
    setSafetyTermsAccepted(Boolean(nextSettings.termsSafetyAcceptedAt));
    setHvAccessRequests(Array.isArray(requests) ? requests : []);
  }

  async function loadSafetyProfile(existingSession?: Session | null) {
    setSafetyLoading(true);

    try {
      const session =
        existingSession ??
        (await supabase.auth.getSession()).data.session ??
        null;

      if (!session?.access_token) {
        setSafetyProfile(null);
        setSafetySettings(defaultSafetySettings);
        setHvAccessRequests([]);
        return;
      }

      const { response, data } = await fetchJsonWithTimeout<{
        profile?: SafetyProfileState;
        settings?: Partial<SafetySettingsState>;
        hvRequests?: HvAccessRequest[];
        error?: string;
      }>(
        "/api/account/safety",
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
        9000
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Sicherheitsprofil konnte nicht geladen werden."
        );
      }

      applySafetyState(data.profile, data.settings, data.hvRequests);
    } catch (error) {
      console.error("Sicherheitsprofil konnte nicht geladen werden:", error);
      setSafetyProfile(null);
      setHvAccessRequests([]);
      setError(
        `Sicherheitsprofil konnte nicht geladen werden: ${getErrorMessage(error)}`
      );
    } finally {
      setSafetyLoading(false);
    }
  }

  function applyProfileToState(
    profile: WorkshopProfileDatabaseRow,
    currentUser: User
  ) {
    const localAccount = convertProfileToDemoAccount(profile);

    setSavedAccount(localAccount);
    setName(localAccount.name);
    setWorkshop(localAccount.workshop);
    setRole(localAccount.role);
    setPlan(normalizeUserPlan(localAccount.plan));
    setDatabaseProfile(profile);

    syncWorkshopProfileToLocalStorage(profile);
    notifyWorkshopProfileChanged();

    if (currentUser.email) {
      setAuthEmail(currentUser.email);
    }
  }

  async function loadWorkshopProfile(
    currentUser: User
  ): Promise<WorkshopProfileDatabaseRow | null> {
    setProfileLoading(true);
    setError("");

    try {
      const profile = await withTimeout(
        loadWorkshopProfileFromSupabase(supabase, currentUser),
        9000,
        "Nutzerprofil"
      );

      if (!profile) {
        setDatabaseProfile(null);
        setSavedAccount(null);
        return null;
      }

      applyProfileToState(profile, currentUser);
      return profile;
    } catch (error) {
      setError(
        `Nutzerprofil konnte nicht geladen werden: ${getErrorMessage(error)}`
      );
      return null;
    } finally {
      setProfileLoading(false);
    }
  }

  function showSuccess(message: string) {
    setSuccess(message);

    window.setTimeout(() => {
      setSuccess("");
    }, 3000);
  }

  function resetMessages() {
    setAuthError("");
    setAuthMessage("");
    setError("");
    setSuccess("");
    setProfileGuidance("");
  }

  function openProfileSetup(message: string) {
    setProfileGuidance(message);
    scheduleProfileScroll(profileSectionRef);
    window.setTimeout(() => {
      profileNameInputRef.current?.focus();
      profileNameInputRef.current?.select();
    }, 220);
  }

  async function handleRegister() {
    resetMessages();

    const cleanEmail = authEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    if (authPassword.length < 6) {
      setAuthError("Das Passwort muss mindestens 6 Zeichen haben.");
      return;
    }

    setAuthLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/login?setup=profile`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: authPassword,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) {
        setAuthError(getFriendlyAuthError(error.message));
        return;
      }

      if (data.session) {
        setUser(data.user);
        setAuthPassword("");
        setAuthMessage(
          "Account erstellt. Bitte lege jetzt dein Nutzerprofil an."
        );

        if (data.user) {
          clearLocalWorkshopProfileState();
          notifyWorkshopProfileChanged();
          openRequiredProfileSetup(
            null,
            data.user,
            "Bitte erstelle jetzt dein Nutzerprofil. Danach sind deine Daten zentral gespeichert."
          );
        }

        if (data.session) {
          await loadDeviceAccess(data.session);
          await loadSafetyProfile(data.session);
        }

        return;
      }

      setAuthMessage(
        "Registrierung erstellt. Prüfe deine E-Mails. Nach der Bestätigung kommst du automatisch zum Nutzerprofil."
      );
    } catch (error) {
      setAuthError(
        `Registrierung fehlgeschlagen: ${getFriendlyAuthError(
          getErrorMessage(error)
        )}`
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin() {
    resetMessages();

    const cleanEmail = authEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    if (!authPassword) {
      setAuthError("Bitte gib dein Passwort ein.");
      return;
    }

    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: authPassword,
      });

      if (error) {
        setAuthError(getFriendlyAuthError(error.message));
        return;
      }

      setUser(data.user);
      setAuthPassword("");
      setAuthMessage("Login erfolgreich.");

      if (data.user) {
        void (async () => {
          try {
            const profile = await loadWorkshopProfile(data.user);

            if (needsWorkshopProfileSetup(profile, data.user)) {
              openRequiredProfileSetup(
                profile,
                data.user,
                "Lege jetzt dein Nutzerprofil an. Danach kannst du DiagnoseHUB vollständig nutzen."
              );
            }

            if (data.session) {
              await loadDeviceAccess(data.session);
              await loadSafetyProfile(data.session);
            }
          } catch (setupError) {
            console.error("Login-Nachbereitung fehlgeschlagen:", setupError);
            openProfileSetup(
              "Du bist eingeloggt. Profil oder Geräteprüfung konnten gerade nicht vollständig geladen werden."
            );
          }
        })();
      }
    } catch (error) {
      setAuthError(
        `Login fehlgeschlagen: ${getFriendlyAuthError(getErrorMessage(error))}`
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePasswordResetRequest() {
    resetMessages();

    const cleanEmail = authEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setAuthError("Bitte gib deine E-Mail-Adresse ein.");
      return;
    }

    setAuthLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/passwort-zuruecksetzen`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        setAuthError(getFriendlyAuthError(error.message));
        return;
      }

      setAuthMessage(
        "Wenn zu dieser E-Mail ein Account existiert, wurde ein Link zum Zurücksetzen gesendet."
      );
    } catch (error) {
      setAuthError(
        `Passwort-Link konnte nicht gesendet werden: ${getErrorMessage(error)}`
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function openCustomerPortal() {
    resetMessages();
    setPortalLoading(true);

    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw new Error(error.message);
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error("Bitte zuerst einloggen.");
      }

      const { response, data: payload } = await fetchJsonWithTimeout<{
        url?: string;
        error?: string;
      }>(
        "/api/stripe/portal",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        20000
      );

      if (!response.ok) {
        throw new Error(
          payload.error || "Stripe Kundenportal konnte nicht geöffnet werden."
        );
      }

      if (!payload.url) {
        throw new Error("Stripe Kundenportal URL fehlt.");
      }

      window.location.href = payload.url;
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleLogout() {
    resetMessages();
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setUser(null);
      setDatabaseProfile(null);
      setSavedAccount(null);
      setDeviceAccess(null);
      setSafetyProfile(null);
      setSafetySettings(defaultSafetySettings);
      setHvAccessRequests([]);
      setSafetyTermsAccepted(false);
      setHvSafetyConfirmation(false);
      setName("");
      setWorkshop("");
      setRole(DEFAULT_ROLE);
      setPlan("free");
      setAuthPassword("");
      clearLocalWorkshopProfileState();
      notifyWorkshopProfileChanged();
      setAuthMessage("Du wurdest ausgeloggt.");
    } catch (error) {
      setAuthError(`Logout fehlgeschlagen: ${getErrorMessage(error)}`);
    } finally {
      setAuthLoading(false);
    }
  }

  async function saveAccount() {
    setError("");
    setSuccess("");

    if (!user) {
      setError("Bitte zuerst einloggen.");
      return;
    }

    const cleanName = name.trim();
    const cleanWorkshop = workshop.trim();
    const cleanRole = role.trim();
    const authUserEmail = user.email || authEmail.trim().toLowerCase();

    if (!cleanName) {
      setError("Bitte gib einen Namen ein.");
      return;
    }

    if (!authUserEmail || !authUserEmail.includes("@")) {
      setError("Keine gültige E-Mail-Adresse gefunden.");
      return;
    }

    setProfileLoading(true);

    try {
      const profile = await saveWorkshopProfileToSupabase(supabase, user, {
        fullName: cleanName,
        workshopName: cleanWorkshop,
        email: authUserEmail,
        role: cleanRole || DEFAULT_ROLE,
      });

      applyProfileToState(profile, user);
      setSafetySettings((currentSettings) => ({
        ...currentSettings,
        companyName:
          currentSettings.companyName ||
          cleanWorkshop ||
          profile.workshop_name ||
          "",
      }));
      setProfileGuidance("");

      showSuccess(
        "Nutzerprofil wurde gespeichert. Header, Dashboard und Diagnose nutzen diese Daten."
      );
    } catch (error) {
      setError(
        `Nutzerprofil konnte nicht gespeichert werden: ${getErrorMessage(error)}`
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function saveSafetyProfile() {
    setError("");
    setSuccess("");

    if (!user) {
      setError("Bitte zuerst einloggen.");
      return;
    }

    if (!safetyTermsAccepted) {
      setError(
        "Bitte bestätige die Sicherheits- und Datenhinweise, bevor du die Einstufung speicherst."
      );
      return;
    }

    setSafetyLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Bitte zuerst einloggen.");
      }

      const { response, data } = await fetchJsonWithTimeout<{
        profile?: SafetyProfileState;
        settings?: Partial<SafetySettingsState>;
        error?: string;
      }>(
        "/api/account/safety",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountType: safetySettings.accountType,
            role: safetySettings.role,
            companyName:
              safetySettings.companyName.trim() || workshop.trim(),
            companyAddress: safetySettings.companyAddress,
            companyPhone: safetySettings.companyPhone,
            companyWebsite: safetySettings.companyWebsite,
            safetyTermsAccepted,
          }),
        },
        12000
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Sicherheitsprofil konnte nicht gespeichert werden."
        );
      }

      applySafetyState(data.profile, data.settings, hvAccessRequests);
      await loadWorkshopProfile(user);
      notifyWorkshopProfileChanged();
      showSuccess(
        "Sicherheitsprofil wurde gespeichert. Die Anzeige im Dashboard nutzt diese Einstufung."
      );
    } catch (error) {
      setError(
        `Sicherheitsprofil konnte nicht gespeichert werden: ${getErrorMessage(error)}`
      );
    } finally {
      setSafetyLoading(false);
    }
  }

  async function requestHvAccess() {
    setError("");
    setSuccess("");

    if (!user) {
      setError("Bitte zuerst einloggen.");
      return;
    }

    if (!hvSafetyConfirmation) {
      setError(
        "Bitte bestätige, dass Hochvolt-Arbeiten nur mit passender Qualifikation und nach Herstellervorgaben durchgeführt werden."
      );
      return;
    }

    if (safetySettings.hvQualification === "none") {
      setError("Bitte wähle deine Hochvolt-Qualifikation aus.");
      return;
    }

    setHvRequestLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error("Bitte zuerst einloggen.");
      }

      const { response, data } = await fetchJsonWithTimeout<{
        hvRequest?: HvAccessRequest;
        error?: string;
      }>(
        "/api/account/safety",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hvQualification: safetySettings.hvQualification,
            trainingProvider: safetySettings.hvTrainingProvider,
            trainingDate: safetySettings.hvTrainingDate,
            certificateUrl: safetySettings.hvCertificateUrl,
            certificateName: safetySettings.hvCertificateName,
            companyName:
              safetySettings.companyName.trim() || workshop.trim(),
            safetyConfirmation: hvSafetyConfirmation,
          }),
        },
        12000
      );

      if (!response.ok) {
        throw new Error(
          data.error || "Hochvolt-Antrag konnte nicht gespeichert werden."
        );
      }

      await loadSafetyProfile(sessionData.session);
      setHvSafetyConfirmation(false);
      showSuccess(
        "Hochvolt-Antrag wurde gespeichert. Freigabe erfolgt erst nach manueller Prüfung."
      );
    } catch (error) {
      setError(
        `Hochvolt-Antrag konnte nicht gespeichert werden: ${getErrorMessage(error)}`
      );
    } finally {
      setHvRequestLoading(false);
    }
  }

  async function deleteDatabaseProfile() {
    setError("");
    setSuccess("");

    if (!user) {
      setError("Bitte zuerst einloggen.");
      return;
    }

    const confirmed = window.confirm(
      "Nutzerprofil wirklich löschen? Der Login-Account bleibt bestehen."
    );

    if (!confirmed) {
      return;
    }

    setProfileLoading(true);

    try {
      await deleteWorkshopProfileFromSupabase(supabase, user);

      setDatabaseProfile(null);
      setSavedAccount(null);
      setName("");
      setWorkshop("");
      setRole(DEFAULT_ROLE);
      setPlan("free");

      clearLocalWorkshopProfileState();
      notifyWorkshopProfileChanged();

      showSuccess("Nutzerprofil wurde gelöscht.");
    } catch (error) {
      setError(
        `Nutzerprofil konnte nicht gelöscht werden: ${getErrorMessage(error)}`
      );
    } finally {
      setProfileLoading(false);
    }
  }

  async function removeDevice(deviceId: string) {
    setError("");
    setSuccess("");
    setDeviceLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setError("Bitte zuerst einloggen.");
        return;
      }

      await removeRegisteredDevice(accessToken, deviceId);
      await loadDeviceAccess(data.session);
      showSuccess("Gerät wurde entfernt.");
    } catch (error) {
      setError(`Gerät konnte nicht entfernt werden: ${getErrorMessage(error)}`);
    } finally {
      setDeviceLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <Header />

      <main className="mx-auto max-w-7xl px-6 py-14">
        <section className="grid gap-10 lg:grid-cols-[0.9fr_1fr] lg:items-start">
          <div>
            <div className="inline-flex rounded-full border border-green-200 bg-green-50 px-5 py-2 text-sm font-black text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
              Account + Daten
            </div>

            <h1 className="mt-6 text-5xl font-black tracking-tight text-slate-950 dark:text-white md:text-6xl">
              Account einrichten.
            </h1>

            <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-300">
              Hier erledigst du alles, was ein Nutzer braucht: einloggen,
              Profil speichern, Tarif prüfen und Geräte verwalten.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {setupSteps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="font-black text-slate-950 dark:text-white">
                    {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Account-Status
              </p>

              <h2 className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">
                {accountStatus}
              </h2>

              {user ? (
                <div className="mt-5 space-y-3 text-slate-600 dark:text-slate-300">
                  <p>
                    E-Mail:{" "}
                    <span className="font-semibold text-slate-950 dark:text-white">
                      {user.email}
                    </span>
                  </p>

                  <p>
                    User-ID:{" "}
                    <span className="break-all font-mono text-sm text-slate-700 dark:text-slate-300">
                      {user.id}
                    </span>
                  </p>

                  {databaseProfile ? (
                    <>
                      <p>
                        Betrieb/Firma:{" "}
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {databaseProfile.workshop_name}
                        </span>
                      </p>

                      <p>
                        Name:{" "}
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {databaseProfile.full_name}
                        </span>
                      </p>

                      <p>
                        Plan:{" "}
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {getSafePlanConfig(databaseProfile.plan).label}
                        </span>
                      </p>

                      <p>
                        Aktualisiert:{" "}
                        <span className="font-semibold text-slate-950 dark:text-white">
                          {formatDateTime(databaseProfile.updated_at)}
                        </span>
                      </p>
                    </>
                  ) : (
                    <p className="text-yellow-700 dark:text-yellow-300">
                      Noch kein Nutzerprofil gespeichert.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
                  Noch nicht eingeloggt. Registriere dich oder melde dich mit
                  einem bestehenden Account an.
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500"
                >
                  Zum Dashboard
                </Link>

                <Link
                  href="/#diagnose"
                  className="rounded-2xl border border-slate-300 bg-white px-5 py-3 font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Zur Diagnose
                </Link>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-500/20 dark:bg-blue-500/10">
              <p className="font-bold text-blue-700 dark:text-blue-300">
                Aktueller Stand
              </p>

              <p className="mt-3 leading-7 text-slate-700 dark:text-slate-300">
                Nutzerprofil, Diagnosefälle und Nutzungszähler sind für
                eingeloggte Nutzer mit deinem Konto verbunden. Lokale Daten bleiben
                nur als Fallback und für die Übernahme erhalten.
              </p>
            </div>

            {user && (
              <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      Gerätezugriff
                    </p>
                    <h2 className="mt-3 text-2xl font-black text-slate-950 dark:text-white">
                      {deviceAccess
                        ? deviceAccess.ok
                          ? `${deviceAccess.activeDeviceCount}/${deviceAccess.maxDevices} Geräte aktiv`
                          : "Geräteprüfung offen"
                        : "Geräte werden geprüft"}
                    </h2>
                    <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
                      Erlaubt sind 3 aktive Geräte/Sessions pro Account.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadDeviceAccess()}
                    disabled={deviceLoading}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {deviceLoading ? "Lädt..." : "Aktualisieren"}
                  </button>
                </div>

                {deviceAccess && !deviceAccess.ok && (
                  <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm leading-6 text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200">
                    {deviceAccess.error ||
                      "Gerätezugriff konnte nicht geprüft werden. Bitte später erneut versuchen."}
                  </div>
                )}

                {deviceAccess && deviceAccess.devices.length > 0 && (
                  <div className="mt-5 grid gap-3">
                    {deviceAccess.devices.map((device) => (
                      <div
                        key={device.deviceId}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-black text-slate-950 dark:text-white">
                              {device.deviceName}
                              {device.current ? " · dieses Gerät" : ""}
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              Zuletzt aktiv: {formatDateTime(device.lastSeenAt)}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => void removeDevice(device.deviceId)}
                            disabled={deviceLoading || device.current}
                            className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-slate-950 dark:text-red-300 dark:hover:bg-red-500/10"
                          >
                            Entfernen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="order-first space-y-8 lg:order-none">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Login
              </p>

              <h2 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
                {user ? "Eingeloggt" : "Login / Registrierung"}
              </h2>

              {!user && (
                <>
                  <div className="mt-6 flex rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("login");
                        resetMessages();
                      }}
                      className={
                        authMode === "login"
                          ? "flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
                          : "flex-1 rounded-xl px-4 py-3 font-bold text-slate-600 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                      }
                    >
                      Einloggen
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("register");
                        resetMessages();
                      }}
                      className={
                        authMode === "register"
                          ? "flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white"
                          : "flex-1 rounded-xl px-4 py-3 font-bold text-slate-600 transition hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                      }
                    >
                      Registrieren
                    </button>
                  </div>

                  <div
                    data-enter-scope
                    data-enter-submit-target="auth-submit-button"
                    onKeyDown={handleEnterToNextField}
                  >
                    <div className="mt-6 grid gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                          E-Mail
                        </label>

                        <input
                          data-enter-next
                          value={authEmail}
                          onChange={(event) => setAuthEmail(event.target.value)}
                          placeholder="mail@beispiel.de"
                          autoComplete="email"
                          className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                        />
                      </div>

                      {authMode !== "reset" && (
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Passwort
                          </label>

                          <input
                            data-enter-next
                            value={authPassword}
                            onChange={(event) =>
                              setAuthPassword(event.target.value)
                            }
                            type="password"
                            placeholder="Mindestens 6 Zeichen"
                            autoComplete={
                              authMode === "login"
                                ? "current-password"
                                : "new-password"
                            }
                            className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      id="auth-submit-button"
                      data-enter-next
                      type="button"
                      onClick={
                        authMode === "login"
                          ? handleLogin
                          : authMode === "register"
                            ? handleRegister
                            : handlePasswordResetRequest
                      }
                      disabled={authLoading}
                      className="mt-6 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {authLoading
                        ? "Bitte warten..."
                        : authMode === "login"
                          ? "Einloggen"
                          : authMode === "register"
                            ? "Account erstellen"
                            : "Link senden"}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
                    {authMode !== "reset" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("reset");
                          setAuthPassword("");
                        resetMessages();
                      }}
                        className="text-blue-700 transition hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        Passwort vergessen?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("login");
                        resetMessages();
                      }}
                        className="text-blue-700 transition hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                      >
                        Zurück zum Login
                      </button>
                    )}
                  </div>
                </>
              )}

              {user && (
                <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-500/30 dark:bg-green-500/10">
                  <p className="font-bold text-green-700 dark:text-green-300">
                    Anmeldung aktiv
                  </p>

                  <p className="mt-2 leading-7 text-slate-700 dark:text-slate-300">
                    Du bist mit {user.email} eingeloggt.
                  </p>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={authLoading}
                    className="mt-5 rounded-2xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    Ausloggen
                  </button>
                </div>
              )}

              {authMessage && (
                <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
                  {authMessage}
                </div>
              )}

              {authError && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {authError}
                </div>
              )}
            </div>

            <div
              id="nutzerprofil"
              ref={profileSectionRef}
              className={
                profileGuidance
                  ? "scroll-mt-28 rounded-3xl border border-blue-400 bg-white p-6 shadow-lg shadow-blue-100 ring-4 ring-blue-100 dark:border-blue-500 dark:bg-slate-900/80 dark:shadow-blue-950/20 dark:ring-blue-500/10"
                  : "scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
              }
            >
              <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                Nutzerprofil
              </p>

              <h2 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
                Nutzerprofil erstellen
              </h2>

              {profileGuidance && (
                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm font-bold leading-6 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                  {profileGuidance}
                </div>
              )}

              <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                Das Profil verbindet deinen Login mit Dashboard, Diagnose,
                gespeicherten Fällen und Service-Erinnerung. Betrieb/Firma ist
                optional und kann für private Nutzer leer bleiben.
              </p>

              <div
                className="mt-8 grid gap-4"
                data-enter-scope
                data-enter-submit-target="profile-save-button"
                onKeyDown={handleEnterToNextField}
              >
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Name
                  </label>

                  <input
                    ref={profileNameInputRef}
                    data-enter-next
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Max Mustermann"
                    disabled={!user || profileLoading}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Betrieb/Firma optional
                  </label>

                  <input
                    data-enter-next
                    value={workshop}
                    onChange={(event) => setWorkshop(event.target.value)}
                    placeholder="Optional, z. B. KFZ Musterbetrieb"
                    disabled={!user || profileLoading}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                  />
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Für private Nutzer kann dieses Feld leer bleiben.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Login-E-Mail
                  </label>

                  <input
                    value={user?.email || authEmail}
                    disabled
                    className="w-full cursor-not-allowed rounded-2xl border border-slate-300 bg-slate-100 px-5 py-4 text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Rolle
                  </label>

                  <input
                    data-enter-next
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="Privatnutzer / Mechaniker / Meister / Inhaber"
                    disabled={!user || profileLoading}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      Sicherheits- und Qualifikationsprofil
                    </p>
                    <h3 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                      Einstufung für Anleitungen
                    </h3>
                    <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
                      Diese Angaben beeinflussen, wie sicherheitskritische
                      Inhalte angezeigt werden. Höhere Freigaben werden manuell
                      geprüft.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void loadSafetyProfile()}
                    disabled={!user || safetyLoading}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {safetyLoading ? "Lädt..." : "Aktualisieren"}
                  </button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Kontotyp</p>
                    <p className="mt-2 font-black text-slate-950 dark:text-white">
                      {safetyProfile
                        ? safetyAccountTypeLabels[safetyProfile.accountType]
                        : "Nicht geladen"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Qualifikation</p>
                    <p className="mt-2 font-black text-slate-950 dark:text-white">
                      {safetyProfile
                        ? qualificationLabels[safetyProfile.qualificationLevel]
                        : "Nicht geladen"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Freigabestufe</p>
                    <p className="mt-2 font-black text-slate-950 dark:text-white">
                      {safetyProfile
                        ? riskAccessLabels[safetyProfile.riskAccessLevel]
                        : "Nicht geladen"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <p className="text-sm text-slate-500">Hochvolt</p>
                    <p className="mt-2 font-black text-slate-950 dark:text-white">
                      {safetyProfile?.hvVerified
                        ? `${hvQualificationLabels[safetyProfile.hvQualification]} freigegeben`
                        : hvAccessRequests[0]
                          ? hvRequestStatusLabels[hvAccessRequests[0].status]
                          : "Nicht freigegeben"}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-6 grid gap-4 md:grid-cols-2"
                  data-enter-scope
                  data-enter-submit-target="safety-terms-checkbox"
                  onKeyDown={handleEnterToNextField}
                >
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Kontotyp
                    </label>
                    <select
                      value={safetySettings.accountType}
                      onChange={(event) =>
                        setSafetySettings((currentSettings) => ({
                          ...currentSettings,
                          accountType: event.target.value as SafetyAccountType,
                        }))
                      }
                      disabled={!user || safetyLoading}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="private">Privatnutzer</option>
                      <option value="mechanic">Mechaniker</option>
                      <option value="workshop">Werkstatt</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Tätigkeit
                    </label>
                    <select
                      value={safetySettings.role}
                      onChange={(event) =>
                        setSafetySettings((currentSettings) => ({
                          ...currentSettings,
                          role: event.target.value as SafetyRole,
                        }))
                      }
                      disabled={!user || safetyLoading}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    >
                      {Object.entries(safetyRoleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Betrieb/Firma für Einstufung
                    </label>
                    <input
                      data-enter-next
                      value={safetySettings.companyName}
                      onChange={(event) =>
                        setSafetySettings((currentSettings) => ({
                          ...currentSettings,
                          companyName: event.target.value,
                        }))
                      }
                      placeholder="Optional, z. B. KFZ Musterbetrieb"
                      disabled={!user || safetyLoading}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Telefon
                    </label>
                    <input
                      data-enter-next
                      value={safetySettings.companyPhone}
                      onChange={(event) =>
                        setSafetySettings((currentSettings) => ({
                          ...currentSettings,
                          companyPhone: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                      disabled={!user || safetyLoading}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Anschrift
                    </label>
                    <input
                      data-enter-next
                      value={safetySettings.companyAddress}
                      onChange={(event) =>
                        setSafetySettings((currentSettings) => ({
                          ...currentSettings,
                          companyAddress: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                      disabled={!user || safetyLoading}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Website
                    </label>
                    <input
                      data-enter-next
                      value={safetySettings.companyWebsite}
                      onChange={(event) =>
                        setSafetySettings((currentSettings) => ({
                          ...currentSettings,
                          companyWebsite: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                      disabled={!user || safetyLoading}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <label className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  <input
                    id="safety-terms-checkbox"
                    type="checkbox"
                    checked={safetyTermsAccepted}
                    onChange={(event) =>
                      setSafetyTermsAccepted(event.target.checked)
                    }
                    disabled={!user || safetyLoading}
                    className="mt-1 h-4 w-4 shrink-0"
                  />
                  <span>
                    Ich bestätige, dass meine Angaben korrekt eingetragen wurden
                    und dass DiagnoseHUB diese Daten so verarbeitet, wie sie
                    eingegeben wurden. DiagnoseHUB übernimmt keine Verantwortung
                    für Richtigkeit, Vollständigkeit oder Aktualität der
                    angegebenen Daten.
                  </span>
                </label>

                <button
                  type="button"
                  onClick={saveSafetyProfile}
                  disabled={!user || safetyLoading}
                  className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {safetyLoading ? "Speichert..." : "Qualifikation speichern"}
                </button>

                <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
                  <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    Hochvolt-Antrag
                  </p>
                  <p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">
                    Hochvolt wird nicht automatisch freigeschaltet. Du kannst
                    deine Qualifikation hinterlegen; die Freigabe erfolgt
                    manuell.
                  </p>

                  <div
                    className="mt-5 grid gap-4 md:grid-cols-2"
                    data-enter-scope
                    data-enter-submit-target="hv-confirmation-checkbox"
                    onKeyDown={handleEnterToNextField}
                  >
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        HV-Qualifikation
                      </label>
                      <select
                        value={safetySettings.hvQualification}
                        onChange={(event) =>
                          setSafetySettings((currentSettings) => ({
                            ...currentSettings,
                            hvQualification: event.target
                              .value as HvQualification,
                          }))
                        }
                        disabled={!user || hvRequestLoading}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                      >
                        <option value="none">Keine</option>
                        <option value="hv1">HV 1</option>
                        <option value="hv2">HV 2</option>
                        <option value="hv3">HV 3</option>
                        <option value="other">Andere HV-Qualifikation</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Schulungsanbieter
                      </label>
                      <input
                        data-enter-next
                        value={safetySettings.hvTrainingProvider}
                        onChange={(event) =>
                          setSafetySettings((currentSettings) => ({
                            ...currentSettings,
                            hvTrainingProvider: event.target.value,
                          }))
                        }
                        placeholder="Optional"
                        disabled={!user || hvRequestLoading}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Schulungsdatum
                      </label>
                      <input
                        data-enter-next
                        type="date"
                        value={safetySettings.hvTrainingDate}
                        onChange={(event) =>
                          setSafetySettings((currentSettings) => ({
                            ...currentSettings,
                            hvTrainingDate: event.target.value,
                          }))
                        }
                        disabled={!user || hvRequestLoading}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Zertifikat / Nachweis
                      </label>
                      <input
                        data-enter-next
                        value={safetySettings.hvCertificateName}
                        onChange={(event) =>
                          setSafetySettings((currentSettings) => ({
                            ...currentSettings,
                            hvCertificateName: event.target.value,
                          }))
                        }
                        placeholder="Optional, z. B. Zertifikatname"
                        disabled={!user || hvRequestLoading}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Link zum Nachweis
                      </label>
                      <input
                        data-enter-next
                        value={safetySettings.hvCertificateUrl}
                        onChange={(event) =>
                          setSafetySettings((currentSettings) => ({
                            ...currentSettings,
                            hvCertificateUrl: event.target.value,
                          }))
                        }
                        placeholder="Optional, z. B. interner Link oder Datei-URL"
                        disabled={!user || hvRequestLoading}
                        className="w-full rounded-2xl border border-slate-300 bg-white px-5 py-4 text-slate-950 outline-none placeholder:text-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  <label className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                    <input
                      id="hv-confirmation-checkbox"
                      type="checkbox"
                      checked={hvSafetyConfirmation}
                      onChange={(event) =>
                        setHvSafetyConfirmation(event.target.checked)
                      }
                      disabled={!user || hvRequestLoading}
                      className="mt-1 h-4 w-4 shrink-0"
                    />
                    <span>
                      Ich bestätige, dass Hochvolt-Arbeiten lebensgefährlich
                      sein können und nur mit passender Qualifikation,
                      Schutzausrüstung und aktuellen Herstellervorgaben
                      durchgeführt werden dürfen.
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={requestHvAccess}
                    disabled={!user || hvRequestLoading}
                    className="mt-5 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {hvRequestLoading
                      ? "Antrag wird gespeichert..."
                      : "Hochvolt-Freigabe beantragen"}
                  </button>

                  {hvAccessRequests.length > 0 && (
                    <div className="mt-5 grid gap-3">
                      {hvAccessRequests.slice(0, 3).map((request) => (
                        <div
                          key={request.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <p className="font-black text-slate-950 dark:text-white">
                            {hvQualificationLabels[request.hv_qualification]} ·{" "}
                            {hvRequestStatusLabels[request.status]}
                          </p>
                          <p className="mt-1 text-slate-500 dark:text-slate-400">
                            Erstellt: {formatDateTime(request.created_at)}
                          </p>
                          {request.review_comment && (
                            <p className="mt-2 text-slate-700 dark:text-slate-300">
                              {request.review_comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <p className="mb-4 font-bold text-slate-950 dark:text-white">
                  Aktiver Tarif
                </p>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className="inline-flex rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-200">
                        {getSafePlanConfig(plan).badge}
                      </span>

                      <h3 className="mt-3 text-xl font-bold text-slate-950 dark:text-white">
                        {getSafePlanConfig(plan).label}
                      </h3>

                      <p className="mt-2 leading-7 text-slate-700 dark:text-slate-300">
                        {getSafePlanConfig(plan).description}
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                      Aktiv
                    </span>
                  </div>

                  <ul className="mt-4 grid gap-2 md:grid-cols-2">
                    {getSafePlanConfig(plan).features.map((feature) => (
                      <li
                        key={feature}
                        className="flex gap-3 text-sm text-slate-700 dark:text-slate-300"
                      >
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Tarife werden nach Stripe-Zahlung oder durch eine manuelle
                    Admin-Freischaltung gesetzt. Profilangaben ändern deinen
                    Tarif nicht.
                  </p>

                  {plan !== "free" && (
                    <button
                      type="button"
                      onClick={() => void openCustomerPortal()}
                      disabled={!user || portalLoading}
                      className="mt-5 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {portalLoading
                        ? "Kundenportal wird geöffnet..."
                        : "Abo verwalten / kündigen"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  id="profile-save-button"
                  type="button"
                  onClick={saveAccount}
                  disabled={!user || profileLoading}
                  className="rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {profileLoading
                    ? "Speichert..."
                    : "Nutzerprofil speichern"}
                </button>

                <button
                  type="button"
                  onClick={deleteDatabaseProfile}
                  disabled={!user || profileLoading || !databaseProfile}
                  className="rounded-2xl border border-red-200 bg-white px-6 py-4 font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/30 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-500/10"
                >
                  Profil löschen
                </button>
              </div>

              {success && (
                <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
                  {success}
                </div>
              )}

              {error && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {error}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

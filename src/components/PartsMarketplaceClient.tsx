"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchJsonWithTimeout } from "@/utils/clientApi";

type MarketplaceProfile = {
  id: string;
  name: string;
  role: string;
  rank: "azubi" | "geselle" | "meister";
  rankLabel: string;
  companyVerified?: boolean;
  sellerStatus?: string;
  canCreateListing?: boolean;
  canAnswer?: boolean;
  canAccept?: boolean;
};

type PartListing = {
  id: string;
  title: string;
  category: string;
  manufacturer: string;
  part_number: string;
  oe_numbers: string[];
  vehicle_fitment: {
    raw?: string;
  };
  condition_note: string;
  inspection_summary: string;
  price_cents: number | null;
  currency: string;
  warranty_terms: string;
  return_terms: string;
  image_urls?: string[];
  risk_level: string;
  status: string;
  review_notes: string;
  updated_at: string;
  seller: MarketplaceProfile | null;
};

type PartInquiry = {
  id: string;
  requested_part: string;
  vehicle_data: string;
  symptom_context: string;
  status: string;
  created_at: string;
};

type CommunityAnswer = {
  id: string;
  body: string;
  is_accepted: boolean;
  answer_rank: string;
  created_at: string;
  author: MarketplaceProfile | null;
};

type CommunityQuestion = {
  id: string;
  title: string;
  body: string;
  vehicle_data: string;
  tags: string[];
  status: string;
  created_at: string;
  author: MarketplaceProfile | null;
  answers: CommunityAnswer[];
};

type LeaderboardEntry = {
  userId: string;
  points: number;
  profile: MarketplaceProfile | null;
};

type EstimateResult = {
  summary?: string;
  visibleDamage?: string[];
  notSafelyAssessableFromImages?: string[];
  likelyParts?: Array<{
    name: string;
    reason: string;
    certainty: string;
    newOrUsedPossible: string;
  }>;
  laborOperations?: Array<{
    operation: string;
    reason: string;
    hoursMin: number;
    hoursMax: number;
    certainty: string;
  }>;
  paintOrBodyWork?: string[];
  checksBeforeQuote?: string[];
  estimateRange?: {
    currency: string;
    netMin: number;
    netMax: number;
    grossHint: string;
    basis: string;
  };
  confidence?: string;
  missingInformation?: string[];
  riskNotes?: string[];
  customerText?: string;
};

type MarketplaceResponse = {
  profile?: MarketplaceProfile;
  listings?: PartListing[];
  inquiries?: PartInquiry[];
  safetyNote?: string;
  error?: string;
};

type CommunityResponse = {
  profile?: MarketplaceProfile;
  questions?: CommunityQuestion[];
  leaderboard?: LeaderboardEntry[];
  setupNotice?: string;
  error?: string;
};

type EstimateResponse = {
  estimate?: EstimateResult;
  disclaimer?: string;
  error?: string;
};

type RoleVerificationRequest = {
  id: string;
  requestedRank: "geselle" | "meister";
  requestedRankLabel: string;
  requiredDocument: "gesellenbrief" | "meisterbrief";
  documentName: string;
  documentMimeType: string;
  documentSizeBytes: number;
  applicantNote: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewNotes: string;
  reviewedAt: string | null;
  createdAt: string;
};

type RoleVerificationResponse = {
  profile?: {
    rank: "azubi" | "geselle" | "meister";
    rankLabel: string;
    canRequestGeselle: boolean;
    canRequestMeister: boolean;
  };
  isAdmin?: boolean;
  requests?: RoleVerificationRequest[];
  message?: string;
  setupNotice?: string;
  error?: string;
};

type MarketplaceTab = "market" | "offer" | "estimate" | "community";
type PartsMarketplaceView = "marketplace" | "estimate" | "forum";

type PartsMarketplaceClientProps = {
  view?: PartsMarketplaceView;
};

const TAB_HASHES: Record<MarketplaceTab, string> = {
  market: "#teile-finden",
  offer: "#teil-einstellen",
  estimate: "#kva-per-bild",
  community: "#forum",
};

const FIELD_CLASS =
  "w-full rounded-xl border border-slate-400 bg-slate-100 px-3 py-2.5 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-200 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-900/60";

const TAB_CLASS =
  "rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60";

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  in_review: "In Prüfung",
  needs_changes: "Klärung nötig",
  active: "Aktiv",
  paused: "Pausiert",
  sold: "Verkauft",
  rejected: "Abgelehnt",
  archived: "Archiviert",
  new: "Neu",
  seller_contacted: "Anbieter kontaktiert",
  offered: "Angebot erhalten",
  declined: "Abgelehnt",
  closed: "Geschlossen",
  open: "Offen",
  answered: "Beantwortet",
  solved: "Gelöst",
};

const ROLE_VERIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  cancelled: "Zurückgezogen",
};

const SELLER_STATUS_LABELS: Record<string, string> = {
  not_requested: "Nicht beantragt",
  pending: "Prüfung offen",
  verified_dealer: "Geprüfter Händler",
  verified_workshop: "Geprüfte Werkstatt",
  suspended: "Gesperrt",
  rejected: "Abgelehnt",
};

const RISK_LABELS: Record<string, string> = {
  normal: "Normal",
  important: "Wichtig",
  safety_relevant: "Sicherheitsrelevant",
  blocked: "Nicht automatisch freigeben",
};

const INITIAL_LISTING_FORM = {
  title: "",
  category: "",
  manufacturer: "",
  partNumber: "",
  oeNumbers: "",
  vehicleData: "",
  conditionNote: "",
  inspectionSummary: "",
  price: "",
  warrantyTerms: "",
  returnTerms: "",
  riskLevel: "normal",
  acceptTerms: false,
};

const INITIAL_INQUIRY_FORM = {
  listingId: "",
  requestedPart: "",
  vehicleData: "",
  symptomContext: "",
  message: "",
};

const INITIAL_QUESTION_FORM = {
  title: "",
  body: "",
  vehicleData: "",
  tags: "",
};

const INITIAL_ESTIMATE_FORM = {
  title: "",
  vehicleData: "",
  damageDescription: "",
  laborRate: "",
};

function normalizeMarketplaceText(value: unknown) {
  return typeof value === "string"
    ? value
        .toLowerCase()
        .replace(/\u00e4/g, "ae")
        .replace(/\u00f6/g, "oe")
        .replace(/\u00fc/g, "ue")
        .replace(/\u00df/g, "ss")
    : "";
}

function formatPrice(cents: number | null | undefined, currency = "EUR") {
  if (typeof cents !== "number") {
    return "Preis offen";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(value: string) {
  return STATUS_LABELS[value] || value || "Offen";
}

function sellerStatusLabel(value?: string) {
  return SELLER_STATUS_LABELS[value || ""] || "Nicht beantragt";
}

function roleVerificationStatusLabel(value?: string) {
  return ROLE_VERIFICATION_STATUS_LABELS[value || ""] || value || "Offen";
}

function listingSearchText(listing: PartListing) {
  return normalizeMarketplaceText(
    [
      listing.title,
      listing.category,
      listing.manufacturer,
      listing.part_number,
      ...(listing.oe_numbers || []),
      listing.vehicle_fitment?.raw || "",
      listing.condition_note,
      listing.inspection_summary,
      listing.seller?.name || "",
    ].join(" ")
  );
}

function getListingImage(listing: PartListing) {
  return listing.image_urls?.[0] || "";
}

function getListingFitment(listing: PartListing) {
  return listing.vehicle_fitment?.raw || "Passung bitte mit Fahrzeugdaten prüfen.";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

function getTabFromHash(hash: string): MarketplaceTab | null {
  const normalizedHash = hash.toLowerCase();

  if (normalizedHash === "#kva-per-bild" || normalizedHash === "#kva") {
    return "estimate";
  }

  if (
    normalizedHash === "#forum" ||
    normalizedHash === "#fragen" ||
    normalizedHash === "#rangliste"
  ) {
    return "community";
  }

  if (normalizedHash === "#teil-einstellen") {
    return "offer";
  }

  if (normalizedHash === "#teile-finden" || normalizedHash === "#teilemarkt") {
    return "market";
  }

  return null;
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };
    reader.onerror = () => {
      reject(new Error("Bild konnte nicht gelesen werden."));
    };
    reader.readAsDataURL(file);
  });
}

function TextList({
  title,
  items,
}: {
  title: string;
  items?: string[];
}) {
  const cleanItems = (items || []).filter(Boolean);

  if (cleanItems.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
        {cleanItems.map((item) => (
          <li key={item} className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-900">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PartsMarketplaceClient({
  view = "marketplace",
}: PartsMarketplaceClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const initialActiveTab: MarketplaceTab =
    view === "estimate" ? "estimate" : view === "forum" ? "community" : "market";
  const [activeTab, setActiveTab] = useState<MarketplaceTab>(initialActiveTab);
  const [profile, setProfile] = useState<MarketplaceProfile | null>(null);
  const [listings, setListings] = useState<PartListing[]>([]);
  const [inquiries, setInquiries] = useState<PartInquiry[]>([]);
  const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [marketplaceSearch, setMarketplaceSearch] = useState("");
  const [marketplaceCategory, setMarketplaceCategory] = useState("all");
  const [marketplaceRisk, setMarketplaceRisk] = useState("all");
  const [marketplacePrice, setMarketplacePrice] = useState("all");
  const [marketplaceSort, setMarketplaceSort] = useState("newest");
  const [selectedListingId, setSelectedListingId] = useState("");
  const [listingForm, setListingForm] = useState(INITIAL_LISTING_FORM);
  const [inquiryForm, setInquiryForm] = useState(INITIAL_INQUIRY_FORM);
  const [questionForm, setQuestionForm] = useState(INITIAL_QUESTION_FORM);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [estimateForm, setEstimateForm] = useState(INITIAL_ESTIMATE_FORM);
  const [estimateImages, setEstimateImages] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [roleVerificationProfile, setRoleVerificationProfile] =
    useState<RoleVerificationResponse["profile"] | null>(null);
  const [roleVerificationRequests, setRoleVerificationRequests] = useState<
    RoleVerificationRequest[]
  >([]);
  const [communitySetupNotice, setCommunitySetupNotice] = useState("");
  const [roleVerificationError, setRoleVerificationError] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(view !== "estimate");
  const [submitting, setSubmitting] = useState(false);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();

    return data.session?.access_token || "";
  }

  async function requestJson<T extends { error?: string }>(
    path: string,
    init: RequestInit = {},
    timeoutMs = 30000
  ) {
    const token = await getAccessToken();

    if (!token) {
      const accessTarget =
        view === "forum"
          ? "das Forum"
          : view === "estimate"
            ? "KVA per Bild"
            : "den Teilemarkt";

      throw new Error(`Bitte einloggen, um ${accessTarget} zu nutzen.`);
    }

    const { response, data } = await fetchJsonWithTimeout<T>(
      path,
      {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.headers || {}),
        },
      },
      timeoutMs
    );

    if (!response.ok) {
      throw new Error(data.error || `Anfrage fehlgeschlagen: ${response.status}`);
    }

    return data;
  }

  async function loadData() {
    setLoading(true);
    setError("");
    setCommunitySetupNotice("");
    setRoleVerificationError("");

    try {
      if (view === "estimate") {
        return;
      }

      if (view === "forum") {
        const [communityData, roleData] = await Promise.all([
          requestJson<CommunityResponse>("/api/community/questions"),
          requestJson<RoleVerificationResponse>("/api/account/role-verification").catch(
            (loadError) => {
              setRoleVerificationError(getErrorMessage(loadError));
              return null;
            }
          ),
        ]);

        setProfile(communityData.profile || null);
        setQuestions(communityData.questions || []);
        setLeaderboard(communityData.leaderboard || []);
        setCommunitySetupNotice(communityData.setupNotice || "");
        setRoleVerificationProfile(roleData?.profile || null);
        setRoleVerificationRequests(roleData?.requests || []);
        setRoleVerificationError(roleData?.setupNotice || "");
        return;
      }

      const marketplaceData =
        await requestJson<MarketplaceResponse>("/api/teilemarkt");

      setProfile(marketplaceData.profile || null);
      setListings(marketplaceData.listings || []);
      setInquiries(marketplaceData.inquiries || []);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadId = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(loadId);
    };
  }, [view]);

  useEffect(() => {
    if (view !== "marketplace") {
      return;
    }

    function applyHashTab() {
      const hashTab = getTabFromHash(window.location.hash);

      if (hashTab === "estimate") {
        window.location.replace("/kva-per-bild");
        return;
      }

      if (hashTab === "community") {
        window.location.replace("/forum");
        return;
      }

      if (hashTab === "market" || hashTab === "offer") {
        setActiveTab(hashTab);
      }
    }

    applyHashTab();
    window.addEventListener("hashchange", applyHashTab);

    return () => {
      window.removeEventListener("hashchange", applyHashTab);
    };
  }, [view]);

  function changeActiveTab(nextTab: MarketplaceTab) {
    setActiveTab(nextTab);

    if (view !== "marketplace") {
      return;
    }

    const nextHash = TAB_HASHES[nextTab];

    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash);
    }
  }

  async function submitListing() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await requestJson<{ message?: string; error?: string }>("/api/teilemarkt", {
        method: "POST",
        body: JSON.stringify(listingForm),
      });
      setListingForm(INITIAL_LISTING_FORM);
      setMessage("Teil wurde gespeichert und wartet auf Prüfung.");
      await loadData();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitInquiry() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await requestJson<{ message?: string; error?: string }>(
        "/api/teilemarkt/inquiries",
        {
          method: "POST",
          body: JSON.stringify(inquiryForm),
        }
      );
      setInquiryForm(INITIAL_INQUIRY_FORM);
      setMessage("Teileanfrage wurde gespeichert.");
      await loadData();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitQuestion() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await requestJson<{ message?: string; error?: string }>(
        "/api/community/questions",
        {
          method: "POST",
          body: JSON.stringify(questionForm),
        }
      );
      setQuestionForm(INITIAL_QUESTION_FORM);
      setMessage("Forum-Beitrag wurde gespeichert.");
      await loadData();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAnswer(questionId: string) {
    const body = answerDrafts[questionId] || "";

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await requestJson<{ message?: string; error?: string }>(
        "/api/community/answers",
        {
          method: "POST",
          body: JSON.stringify({
            questionId,
            body,
          }),
        }
      );
      setAnswerDrafts((current) => ({ ...current, [questionId]: "" }));
      setMessage("Antwort wurde gespeichert.");
      await loadData();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function acceptAnswer(answerId: string) {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await requestJson<{ message?: string; error?: string }>(
        "/api/community/answers/accept",
        {
          method: "POST",
          body: JSON.stringify({ answerId }),
        }
      );
      setMessage("Antwort wurde als richtig markiert.");
      await loadData();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEstimateFiles(files: FileList | null) {
    if (!files) {
      setEstimateImages([]);
      return;
    }

    const selectedFiles = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, 5);
    const dataUrls = await Promise.all(selectedFiles.map(fileToDataUrl));

    setEstimateImages(dataUrls);
  }

  async function submitEstimate() {
    setSubmitting(true);
    setError("");
    setMessage("");
    setEstimate(null);

    try {
      const data = await requestJson<EstimateResponse>(
        "/api/kostenvoranschlag/bilder",
        {
          method: "POST",
          body: JSON.stringify({
            ...estimateForm,
            images: estimateImages,
          }),
        },
        90000
      );

      setEstimate(data.estimate || null);
      setMessage("Bild-Kostenschätzung wurde erstellt und gespeichert.");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  const selectedInquiryListing = listings.find(
    (listing) => listing.id === inquiryForm.listingId
  );
  const marketplaceCategories = useMemo(() => {
    return Array.from(
      new Set(
        listings
          .map((listing) => listing.category)
          .filter((category): category is string => Boolean(category))
      )
    ).sort((a, b) => a.localeCompare(b, "de"));
  }, [listings]);
  const marketplaceSellerCount = useMemo(() => {
    return new Set(
      listings
        .map((listing) => listing.seller?.id || "")
        .filter(Boolean)
    ).size;
  }, [listings]);
  const filteredListings = useMemo(() => {
    const searchNeedle = normalizeMarketplaceText(marketplaceSearch);

    return listings
      .filter((listing) => {
        if (marketplaceCategory !== "all" && listing.category !== marketplaceCategory) {
          return false;
        }

        if (marketplaceRisk !== "all" && listing.risk_level !== marketplaceRisk) {
          return false;
        }

        if (marketplacePrice === "priced" && typeof listing.price_cents !== "number") {
          return false;
        }

        if (marketplacePrice === "open" && typeof listing.price_cents === "number") {
          return false;
        }

        if (!searchNeedle) {
          return true;
        }

        return listingSearchText(listing).includes(searchNeedle);
      })
      .sort((a, b) => {
        if (marketplaceSort === "price_asc") {
          return (a.price_cents ?? Number.MAX_SAFE_INTEGER) - (b.price_cents ?? Number.MAX_SAFE_INTEGER);
        }

        if (marketplaceSort === "price_desc") {
          return (b.price_cents ?? -1) - (a.price_cents ?? -1);
        }

        if (marketplaceSort === "title") {
          return a.title.localeCompare(b.title, "de");
        }

        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
  }, [
    listings,
    marketplaceCategory,
    marketplacePrice,
    marketplaceRisk,
    marketplaceSearch,
    marketplaceSort,
  ]);
  const selectedListing =
    filteredListings.find((listing) => listing.id === selectedListingId) ||
    selectedInquiryListing ||
    filteredListings[0] ||
    null;
  const isMarketplaceView = view === "marketplace";
  const showMarket = isMarketplaceView && activeTab === "market";
  const showLegacyMarket = false;
  const showOffer = isMarketplaceView && activeTab === "offer";
  const showEstimate = view === "estimate";
  const showForum = view === "forum";
  const heroContent =
    view === "estimate"
      ? {
          eyebrow: "KVA per Bild",
          title: "Schäden per Bild vorsichtig einschätzen.",
          description:
            "Lade Fahrzeug- und Schadensbilder hoch und erhalte einen vorsichtigen Entwurf mit sichtbaren Schäden, Prüfhinweisen, möglichen Arbeitspositionen und grober Spanne.",
        }
      : view === "forum"
        ? {
            eyebrow: "DiagnoseHUB Forum",
            title: "Fachfragen, Antworten und bestätigte Lösungen.",
            description:
              "Im Forum werden Diagnosefragen, Messwerte und Erfahrungen gesammelt. Die zentrale Website-Qualifikation entscheidet, wer antworten oder Lösungen markieren darf.",
          }
        : {
            eyebrow: "DiagnoseHUB Teilemarkt",
            title: "Gebrauchtteile sauber finden und anfragen.",
            description:
              "Geprüfte Anbieter können Teile einstellen, Nutzer können passende Gebrauchtteile mit Fahrzeugdaten und Diagnosekontext anfragen.",
          };

  return (
    <div className="mx-auto max-w-7xl">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-blue-700 dark:text-blue-300">
            {heroContent.eyebrow}
          </p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            {heroContent.title}
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-300">
            {heroContent.description}
          </p>
        </div>

        {showEstimate ? (
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Wichtig
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
              <p>Bilder reichen nur für eine vorsichtige Ersteinschätzung.</p>
              <p>Verdeckte Schäden, Achsvermessung, Airbag, Rahmen und Elektrik müssen am Fahrzeug geprüft werden.</p>
              <p>Die Ausgabe ist ein Entwurf, kein verbindlicher Kostenvoranschlag.</p>
            </div>
          </div>
        ) : showForum ? (
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Deine Website-Qualifikation
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-lg font-black text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
                {profile?.rankLabel || "Azubi"}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              <p>Azubi: DiagnoseHUB nutzen und Fragen stellen</p>
              <p>Geselle: zusätzlich Fachantworten geben</p>
              <p>Meister: zusätzlich richtige Antworten markieren</p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Teilemarktstatus
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-black text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200">
                Anbieter: {sellerStatusLabel(profile?.sellerStatus)}
              </span>
              <span className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                Rang: {profile?.rankLabel || "Azubi"}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              <p>Teile einstellen nur mit passender Freigabe.</p>
              <p>Anfragen sind für passende Gebrauchtteile mit Fahrzeugdaten gedacht.</p>
            </div>
          </div>
        )}
      </section>

      {isMarketplaceView && (
        <div className="mt-8 flex flex-wrap gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
        {([
          ["market", "Teile finden"],
          ["offer", "Teil einstellen"],
        ] as Array<[MarketplaceTab, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => changeActiveTab(key)}
            className={`${TAB_CLASS} ${
              activeTab === key
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-300 bg-white text-slate-800 hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-sm font-bold text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-6 rounded-2xl border border-green-300 bg-green-50 px-5 py-4 text-sm font-bold text-green-800 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-200">
          {message}
        </div>
      )}

      {communitySetupNotice && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          {communitySetupNotice}
        </div>
      )}

      {loading ? (
        <div className="mt-10 rounded-2xl border border-slate-300 bg-white p-8 text-center font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {showForum ? "Forum wird geladen..." : "Teilemarkt wird geladen..."}
        </div>
      ) : (
        <div className="mt-8">
          {showMarket && (
            <section id="teile-finden" className="grid gap-5 xl:grid-cols-[18rem_1fr_24rem]">
              <aside className="space-y-4 rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Suche
                  </p>
                  <input
                    className={`${FIELD_CLASS} mt-3`}
                    placeholder="Teilenummer, OE, Fahrzeug, Bauteil"
                    value={marketplaceSearch}
                    onChange={(event) => setMarketplaceSearch(event.target.value)}
                  />
                </div>

                <label className="block text-sm font-black text-slate-950 dark:text-white">
                  Kategorie
                  <select
                    className={`${FIELD_CLASS} mt-2`}
                    value={marketplaceCategory}
                    onChange={(event) => setMarketplaceCategory(event.target.value)}
                  >
                    <option value="all">Alle Kategorien</option>
                    {marketplaceCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-black text-slate-950 dark:text-white">
                  Preis
                  <select
                    className={`${FIELD_CLASS} mt-2`}
                    value={marketplacePrice}
                    onChange={(event) => setMarketplacePrice(event.target.value)}
                  >
                    <option value="all">Alle Angebote</option>
                    <option value="priced">Mit Preis</option>
                    <option value="open">Preis offen</option>
                  </select>
                </label>

                <label className="block text-sm font-black text-slate-950 dark:text-white">
                  Risiko
                  <select
                    className={`${FIELD_CLASS} mt-2`}
                    value={marketplaceRisk}
                    onChange={(event) => setMarketplaceRisk(event.target.value)}
                  >
                    <option value="all">Alle Risikostufen</option>
                    {Object.entries(RISK_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMarketplaceSearch("");
                    setMarketplaceCategory("all");
                    setMarketplaceRisk("all");
                    setMarketplacePrice("all");
                    setMarketplaceSort("newest");
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Filter zurücksetzen
                </button>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <p className="font-black text-slate-950 dark:text-white">
                    {listings.length} Inserate
                  </p>
                  <p>{marketplaceSellerCount} Anbieter</p>
                  <p>{inquiries.length} eigene Anfragen</p>
                </div>
              </aside>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-950 dark:text-white">
                      {filteredListings.length} Treffer
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Angebote mit Fahrzeugdaten, Teilenummern und Zustand vergleichen.
                    </p>
                  </div>

                  <select
                    className={`${FIELD_CLASS} md:max-w-56`}
                    value={marketplaceSort}
                    onChange={(event) => setMarketplaceSort(event.target.value)}
                  >
                    <option value="newest">Neueste zuerst</option>
                    <option value="price_asc">Preis aufsteigend</option>
                    <option value="price_desc">Preis absteigend</option>
                    <option value="title">Titel A-Z</option>
                  </select>
                </div>

                {filteredListings.length === 0 ? (
                  <div className="rounded-2xl border border-slate-300 bg-white p-8 text-center text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Keine passenden Teile gefunden. Prüfe Suche und Filter oder stelle eine freie Teileanfrage.
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {filteredListings.map((listing) => {
                      const imageUrl = getListingImage(listing);
                      const isSelected = selectedListing?.id === listing.id;

                      return (
                        <article
                          key={listing.id}
                          className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 ${
                            isSelected
                              ? "border-blue-500 ring-2 ring-blue-100 dark:ring-blue-500/20"
                              : "border-slate-300 dark:border-slate-800"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedListingId(listing.id)}
                            className="block w-full text-left"
                          >
                            <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-950">
                              {imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={imageUrl}
                                  alt={listing.title}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500 dark:text-slate-400">
                                  <span className="text-4xl font-black">DH</span>
                                  <span className="mt-2 text-sm font-bold">
                                    Bild folgt nach Anbieterfreigabe
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    {listing.category || "Gebrauchtteil"}
                                  </p>
                                  <h2 className="mt-1 line-clamp-2 text-lg font-black text-slate-950 dark:text-white">
                                    {listing.title}
                                  </h2>
                                </div>
                                <p className="shrink-0 text-right text-lg font-black text-slate-950 dark:text-white">
                                  {formatPrice(listing.price_cents, listing.currency)}
                                </p>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                                  {statusLabel(listing.status)}
                                </span>
                                <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                  {RISK_LABELS[listing.risk_level] || listing.risk_level}
                                </span>
                              </div>

                              <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                                {listing.condition_note}
                              </p>

                              <p className="mt-3 text-sm font-bold text-slate-600 dark:text-slate-400">
                                {listing.seller?.name || "Anbieter nicht angegeben"} ·{" "}
                                {listing.seller?.rankLabel || "Rang offen"}
                              </p>
                            </div>
                          </button>

                          <div className="flex gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setSelectedListingId(listing.id)}
                              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-black text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedListingId(listing.id);
                                setInquiryForm((current) => ({
                                  ...current,
                                  listingId: listing.id,
                                  requestedPart: listing.title,
                                }));
                              }}
                              className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm font-black text-white transition hover:bg-blue-500"
                            >
                              Anfragen
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">
                    Angebotsdetails
                  </h2>

                  {!selectedListing ? (
                    <p className="mt-4 leading-7 text-slate-700 dark:text-slate-300">
                      Wähle ein Inserat aus, um Details, Passung und Anbieter zu prüfen.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div>
                        <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {selectedListing.category || "Gebrauchtteil"}
                        </p>
                        <h3 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                          {selectedListing.title}
                        </h3>
                        <p className="mt-2 text-2xl font-black text-blue-700 dark:text-blue-300">
                          {formatPrice(selectedListing.price_cents, selectedListing.currency)}
                        </p>
                      </div>

                      <div className="grid gap-3 text-sm leading-6">
                        <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-950">
                          <p className="font-black text-slate-950 dark:text-white">
                            Teilenummern
                          </p>
                          <p className="mt-1 text-slate-700 dark:text-slate-300">
                            {[selectedListing.part_number, ...(selectedListing.oe_numbers || [])]
                              .filter(Boolean)
                              .join(", ") || "nicht angegeben"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-950">
                          <p className="font-black text-slate-950 dark:text-white">
                            Passung
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                            {getListingFitment(selectedListing)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-100 p-3 dark:bg-slate-950">
                          <p className="font-black text-slate-950 dark:text-white">
                            Prüfung / Zustand
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                            {selectedListing.inspection_summary}
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                            {selectedListing.condition_note}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
                        Vor Kauf immer Teilenummer, OE-Nummer, Stecker, Index,
                        Codierung und Fahrzeugdaten abgleichen.
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setInquiryForm((current) => ({
                            ...current,
                            listingId: selectedListing.id,
                            requestedPart: selectedListing.title,
                          }))
                        }
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500"
                      >
                        Dieses Teil anfragen
                      </button>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">
                    Teileanfrage
                  </h2>
                  {selectedInquiryListing && (
                    <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
                      Ausgewählt: {selectedInquiryListing.title}
                    </p>
                  )}
                  <div className="mt-4 grid gap-3">
                    <input
                      className={FIELD_CLASS}
                      placeholder="Gesuchtes Teil"
                      value={inquiryForm.requestedPart}
                      onChange={(event) =>
                        setInquiryForm((current) => ({
                          ...current,
                          requestedPart: event.target.value,
                        }))
                      }
                    />
                    <textarea
                      className={FIELD_CLASS}
                      rows={4}
                      placeholder="Fahrzeugdaten: Modell, Baujahr, Motorcode, VIN-Auszug, Laufleistung"
                      value={inquiryForm.vehicleData}
                      onChange={(event) =>
                        setInquiryForm((current) => ({
                          ...current,
                          vehicleData: event.target.value,
                        }))
                      }
                    />
                    <textarea
                      className={FIELD_CLASS}
                      rows={3}
                      placeholder="Fehlerbild oder Diagnosekontext"
                      value={inquiryForm.symptomContext}
                      onChange={(event) =>
                        setInquiryForm((current) => ({
                          ...current,
                          symptomContext: event.target.value,
                        }))
                      }
                    />
                    <textarea
                      className={FIELD_CLASS}
                      rows={3}
                      placeholder="Nachricht an Anbieter"
                      value={inquiryForm.message}
                      onChange={(event) =>
                        setInquiryForm((current) => ({
                          ...current,
                          message: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={submitInquiry}
                      disabled={submitting}
                      className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      Anfrage speichern
                    </button>
                  </div>

                  <div className="mt-6">
                    <p className="text-sm font-black text-slate-950 dark:text-white">
                      Deine letzten Anfragen
                    </p>
                    <div className="mt-3 grid gap-2">
                      {inquiries.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Noch keine Anfragen vorhanden.
                        </p>
                      ) : (
                        inquiries.slice(0, 5).map((inquiry) => (
                          <div
                            key={inquiry.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                          >
                            <p className="font-bold text-slate-900 dark:text-white">
                              {inquiry.requested_part || "Teileanfrage"}
                            </p>
                            <p className="text-slate-600 dark:text-slate-400">
                              {statusLabel(inquiry.status)} · {formatDate(inquiry.created_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </aside>
            </section>
          )}

          {showLegacyMarket && (
            <section id="teile-finden" className="grid gap-6 lg:grid-cols-[1fr_24rem]">
              <div className="grid gap-4">
                {listings.length === 0 ? (
                  <div className="rounded-2xl border border-slate-300 bg-white p-6 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    Noch keine aktiven oder eigenen Teile vorhanden.
                  </div>
                ) : (
                  listings.map((listing) => (
                    <article
                      key={listing.id}
                      className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            {listing.category || "Gebrauchtteil"}
                          </p>
                          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
                            {listing.title}
                          </h2>
                          <p className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                            {listing.seller?.name || "Anbieter nicht angegeben"} ·{" "}
                            {listing.seller?.rankLabel || "Rang offen"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black text-slate-950 dark:text-white">
                            {formatPrice(listing.price_cents, listing.currency)}
                          </p>
                          <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                            {statusLabel(listing.status)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300 md:grid-cols-2">
                        <p>
                          <span className="font-black text-slate-900 dark:text-white">
                            Zustand:
                          </span>{" "}
                          {listing.condition_note}
                        </p>
                        <p>
                          <span className="font-black text-slate-900 dark:text-white">
                            Prüfung:
                          </span>{" "}
                          {listing.inspection_summary}
                        </p>
                        <p>
                          <span className="font-black text-slate-900 dark:text-white">
                            Nummern:
                          </span>{" "}
                          {[listing.part_number, ...(listing.oe_numbers || [])]
                            .filter(Boolean)
                            .join(", ") || "nicht angegeben"}
                        </p>
                        <p>
                          <span className="font-black text-slate-900 dark:text-white">
                            Risiko:
                          </span>{" "}
                          {RISK_LABELS[listing.risk_level] || listing.risk_level}
                        </p>
                      </div>

                      {listing.review_notes && (
                        <p className="mt-4 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                          {listing.review_notes}
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setInquiryForm((current) => ({
                            ...current,
                            listingId: listing.id,
                            requestedPart: listing.title,
                          }));
                          changeActiveTab("market");
                        }}
                        className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        Teil anfragen
                      </button>
                    </article>
                  ))
                )}
              </div>

              <aside className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  Teileanfrage
                </h2>
                {selectedListing && (
                  <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
                    Ausgewählt: {selectedListing.title}
                  </p>
                )}
                <div className="mt-4 grid gap-3">
                  <input
                    className={FIELD_CLASS}
                    placeholder="Gesuchtes Teil"
                    value={inquiryForm.requestedPart}
                    onChange={(event) =>
                      setInquiryForm((current) => ({
                        ...current,
                        requestedPart: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className={FIELD_CLASS}
                    rows={4}
                    placeholder="Fahrzeugdaten: Modell, Baujahr, Motorcode, VIN-Auszug, Laufleistung"
                    value={inquiryForm.vehicleData}
                    onChange={(event) =>
                      setInquiryForm((current) => ({
                        ...current,
                        vehicleData: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className={FIELD_CLASS}
                    rows={3}
                    placeholder="Fehlerbild oder Diagnosekontext"
                    value={inquiryForm.symptomContext}
                    onChange={(event) =>
                      setInquiryForm((current) => ({
                        ...current,
                        symptomContext: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className={FIELD_CLASS}
                    rows={3}
                    placeholder="Nachricht an Anbieter"
                    value={inquiryForm.message}
                    onChange={(event) =>
                      setInquiryForm((current) => ({
                        ...current,
                        message: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={submitInquiry}
                    disabled={submitting}
                    className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:opacity-60"
                  >
                    Anfrage speichern
                  </button>
                </div>

                <div className="mt-6">
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Deine letzten Anfragen
                  </p>
                  <div className="mt-3 grid gap-2">
                    {inquiries.slice(0, 5).map((inquiry) => (
                      <div
                        key={inquiry.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                      >
                        <p className="font-bold text-slate-900 dark:text-white">
                          {inquiry.requested_part || "Teileanfrage"}
                        </p>
                        <p className="text-slate-600 dark:text-slate-400">
                          {statusLabel(inquiry.status)} · {formatDate(inquiry.created_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>
          )}

          {showOffer && (
            <section id="teil-einstellen" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                  Anbieterregeln
                </h2>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  <p>Nur Gesellen, Meister, geprüfte Händler oder Werkstätten können Teile einstellen.</p>
                  <p>Neue Inserate werden zuerst geprüft und nicht automatisch freigegeben.</p>
                  <p>Sicherheitskritische Teile bleiben gesperrt, bis sie ausdrücklich freigegeben werden.</p>
                  <p>Der Anbieter bleibt verantwortlich für Beschreibung, Eignung, Verkauf, Gewährleistung und Rücknahme.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                  Gebrauchtteil einstellen
                </h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <input
                    className={FIELD_CLASS}
                    placeholder="Titel"
                    value={listingForm.title}
                    onChange={(event) =>
                      setListingForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                  <input
                    className={FIELD_CLASS}
                    placeholder="Kategorie"
                    value={listingForm.category}
                    onChange={(event) =>
                      setListingForm((current) => ({ ...current, category: event.target.value }))
                    }
                  />
                  <input
                    className={FIELD_CLASS}
                    placeholder="Hersteller"
                    value={listingForm.manufacturer}
                    onChange={(event) =>
                      setListingForm((current) => ({ ...current, manufacturer: event.target.value }))
                    }
                  />
                  <input
                    className={FIELD_CLASS}
                    placeholder="Teilenummer"
                    value={listingForm.partNumber}
                    onChange={(event) =>
                      setListingForm((current) => ({ ...current, partNumber: event.target.value }))
                    }
                  />
                  <input
                    className={`${FIELD_CLASS} md:col-span-2`}
                    placeholder="OE-Nummern, getrennt mit Komma"
                    value={listingForm.oeNumbers}
                    onChange={(event) =>
                      setListingForm((current) => ({ ...current, oeNumbers: event.target.value }))
                    }
                  />
                  <textarea
                    className={`${FIELD_CLASS} md:col-span-2`}
                    rows={3}
                    placeholder="Passende Fahrzeugdaten / Spenderfahrzeug / Motorcode"
                    value={listingForm.vehicleData}
                    onChange={(event) =>
                      setListingForm((current) => ({ ...current, vehicleData: event.target.value }))
                    }
                  />
                  <textarea
                    className={`${FIELD_CLASS} md:col-span-2`}
                    rows={3}
                    placeholder="Zustand, Laufleistung, sichtbare Mängel"
                    value={listingForm.conditionNote}
                    onChange={(event) =>
                      setListingForm((current) => ({ ...current, conditionNote: event.target.value }))
                    }
                  />
                  <textarea
                    className={`${FIELD_CLASS} md:col-span-2`}
                    rows={3}
                    placeholder="Was wurde geprüft? Sichtprüfung, Funktion, Messung, Ausbaugrund"
                    value={listingForm.inspectionSummary}
                    onChange={(event) =>
                      setListingForm((current) => ({
                        ...current,
                        inspectionSummary: event.target.value,
                      }))
                    }
                  />
                  <input
                    className={FIELD_CLASS}
                    placeholder="Preis in Euro"
                    value={listingForm.price}
                    onChange={(event) =>
                      setListingForm((current) => ({ ...current, price: event.target.value }))
                    }
                  />
                  <select
                    className={FIELD_CLASS}
                    value={listingForm.riskLevel}
                    onChange={(event) =>
                      setListingForm((current) => ({
                        ...current,
                        riskLevel: event.target.value,
                      }))
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Wichtig</option>
                    <option value="safety_relevant">Sicherheitsrelevant</option>
                    <option value="blocked">Nicht automatisch freigeben</option>
                  </select>
                  <textarea
                    className={FIELD_CLASS}
                    rows={3}
                    placeholder="Gewährleistung / Garantiehinweis"
                    value={listingForm.warrantyTerms}
                    onChange={(event) =>
                      setListingForm((current) => ({
                        ...current,
                        warrantyTerms: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className={FIELD_CLASS}
                    rows={3}
                    placeholder="Rückgabe / Versand / Abholung"
                    value={listingForm.returnTerms}
                    onChange={(event) =>
                      setListingForm((current) => ({
                        ...current,
                        returnTerms: event.target.value,
                      }))
                    }
                  />
                </div>

                <label className="mt-4 flex gap-3 rounded-xl border border-slate-300 bg-slate-100 p-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={listingForm.acceptTerms}
                    onChange={(event) =>
                      setListingForm((current) => ({
                        ...current,
                        acceptTerms: event.target.checked,
                      }))
                    }
                  />
                  Ich bestätige, dass die Angaben vom Anbieter stammen und vor Freigabe geprüft werden müssen.
                </label>

                <button
                  type="button"
                  onClick={submitListing}
                  disabled={submitting || !profile?.canCreateListing}
                  className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Teil zur Prüfung speichern
                </button>

                {!profile?.canCreateListing && (
                  <p className="mt-3 text-sm font-semibold text-red-700 dark:text-red-300">
                    Dein Account darf aktuell noch keine Teile einstellen.
                  </p>
                )}
              </div>
            </section>
          )}

          {showEstimate && (
            <section id="kva-per-bild" className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                  KI-Kostenvoranschlag per Bild
                </h2>
                <div className="mt-5 grid gap-3">
                  <input
                    className={FIELD_CLASS}
                    placeholder="Titel"
                    value={estimateForm.title}
                    onChange={(event) =>
                      setEstimateForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                  <textarea
                    className={FIELD_CLASS}
                    rows={4}
                    placeholder="Fahrzeugdaten"
                    value={estimateForm.vehicleData}
                    onChange={(event) =>
                      setEstimateForm((current) => ({
                        ...current,
                        vehicleData: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className={FIELD_CLASS}
                    rows={4}
                    placeholder="Schadenbeschreibung"
                    value={estimateForm.damageDescription}
                    onChange={(event) =>
                      setEstimateForm((current) => ({
                        ...current,
                        damageDescription: event.target.value,
                      }))
                    }
                  />
                  <input
                    className={FIELD_CLASS}
                    placeholder="Stundensatz netto in Euro, optional"
                    value={estimateForm.laborRate}
                    onChange={(event) =>
                      setEstimateForm((current) => ({
                        ...current,
                        laborRate: event.target.value,
                      }))
                    }
                  />
                  <input
                    className={FIELD_CLASS}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(event) => void handleEstimateFiles(event.target.files)}
                  />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    {estimateImages.length} Bild(er) ausgewählt. Bilder werden nur zur Analyse übertragen; gespeichert wird der Entwurf.
                  </p>
                  <button
                    type="button"
                    onClick={submitEstimate}
                    disabled={submitting || estimateImages.length === 0}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Kostenschätzung erstellen
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                  Ergebnis
                </h2>
                {!estimate ? (
                  <p className="mt-4 leading-7 text-slate-700 dark:text-slate-300">
                    Das Ergebnis zeigt sichtbare Schäden, notwendige Prüfungen,
                    mögliche Teile, Arbeitspositionen und eine grobe Spanne. Es
                    ersetzt keine Prüfung am Fahrzeug.
                  </p>
                ) : (
                  <div className="mt-5 grid gap-5">
                    <div className="rounded-xl bg-slate-100 p-4 dark:bg-slate-950">
                      <p className="text-sm font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Zusammenfassung
                      </p>
                      <p className="mt-2 leading-7 text-slate-800 dark:text-slate-200">
                        {estimate.summary}
                      </p>
                    </div>

                    {estimate.estimateRange && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/40 dark:bg-blue-500/10">
                        <p className="text-sm font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          Grobe Spanne
                        </p>
                        <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                          {estimate.estimateRange.netMin} - {estimate.estimateRange.netMax}{" "}
                          {estimate.estimateRange.currency}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                          {estimate.estimateRange.basis}
                        </p>
                      </div>
                    )}

                    <TextList title="Sichtbar" items={estimate.visibleDamage} />
                    <TextList title="Vor Angebot prüfen" items={estimate.checksBeforeQuote} />
                    <TextList title="Nicht per Bild sicher beurteilbar" items={estimate.notSafelyAssessableFromImages} />
                    <TextList title="Risiko" items={estimate.riskNotes} />

                    {(estimate.likelyParts || []).length > 0 && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Mögliche Teile
                        </p>
                        <div className="mt-2 grid gap-2">
                          {estimate.likelyParts?.map((part) => (
                            <div
                              key={`${part.name}-${part.reason}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                            >
                              <p className="font-black text-slate-950 dark:text-white">
                                {part.name} · Sicherheit {part.certainty}
                              </p>
                              <p className="mt-1 text-slate-700 dark:text-slate-300">
                                {part.reason}
                              </p>
                              <p className="mt-1 text-slate-600 dark:text-slate-400">
                                {part.newOrUsedPossible}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}

          {showForum && (
            <section id="forum" className="grid gap-6 lg:grid-cols-[1fr_24rem]">
              <div className="grid gap-5">
                <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white">
                    Forum-Beitrag erstellen
                  </h2>
                  <div className="mt-4 grid gap-3">
                    <input
                      className={FIELD_CLASS}
                      placeholder="Kurzer Titel"
                      value={questionForm.title}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          title: event.target.value,
                        }))
                      }
                    />
                    <textarea
                      className={FIELD_CLASS}
                      rows={4}
                      placeholder="Problem, Messwerte, Symptome, was wurde geprüft?"
                      value={questionForm.body}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          body: event.target.value,
                        }))
                      }
                    />
                    <textarea
                      className={FIELD_CLASS}
                      rows={3}
                      placeholder="Fahrzeugdaten"
                      value={questionForm.vehicleData}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          vehicleData: event.target.value,
                        }))
                      }
                    />
                    <input
                      className={FIELD_CLASS}
                      placeholder="Tags, z. B. Ladedruck, Diesel, P0299"
                      value={questionForm.tags}
                      onChange={(event) =>
                        setQuestionForm((current) => ({
                          ...current,
                          tags: event.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={submitQuestion}
                      disabled={submitting}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:opacity-60"
                    >
                      Beitrag speichern
                    </button>
                  </div>
                </div>

                {questions.map((question) => (
                  <article
                    key={question.id}
                    className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {statusLabel(question.status)} · {question.author?.rankLabel || "Azubi"}
                        </p>
                        <h3 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                          {question.title}
                        </h3>
                      </div>
                      <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        {question.answers.length} Antwort(en)
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700 dark:text-slate-300">
                      {question.body}
                    </p>
                    {question.vehicle_data && (
                      <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        {question.vehicle_data}
                      </p>
                    )}

                    <div className="mt-4 grid gap-3">
                      {question.answers.map((answer) => (
                        <div
                          key={answer.id}
                          className={`rounded-xl border p-4 ${
                            answer.is_accepted
                              ? "border-green-300 bg-green-50 dark:border-green-500/40 dark:bg-green-500/10"
                              : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-black text-slate-950 dark:text-white">
                              {answer.author?.name || "Antwort"} ·{" "}
                              {answer.author?.rankLabel || answer.answer_rank}
                            </p>
                            {answer.is_accepted ? (
                              <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-black text-white">
                                Richtige Antwort
                              </span>
                            ) : (
                              profile?.canAccept && (
                                <button
                                  type="button"
                                  onClick={() => void acceptAnswer(answer.id)}
                                  disabled={submitting}
                                  className="rounded-lg border border-green-500 px-3 py-1 text-xs font-black text-green-700 transition hover:bg-green-600 hover:text-white dark:text-green-300"
                                >
                                  Als richtig markieren
                                </button>
                              )
                            )}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700 dark:text-slate-300">
                            {answer.body}
                          </p>
                        </div>
                      ))}
                    </div>

                    {profile?.canAnswer && (
                      <div className="mt-4 grid gap-3">
                        <textarea
                          className={FIELD_CLASS}
                          rows={3}
                          placeholder="Fachliche Antwort"
                          value={answerDrafts[question.id] || ""}
                          onChange={(event) =>
                            setAnswerDrafts((current) => ({
                              ...current,
                              [question.id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => void submitAnswer(question.id)}
                          disabled={submitting}
                          className="w-fit rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                        >
                          Antworten
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <aside className="grid gap-5">
                <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">
                    Website-Qualifikation
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                    Aktuelle Einstufung:{" "}
                    <span className="font-black text-slate-950 dark:text-white">
                      {roleVerificationProfile?.rankLabel || profile?.rankLabel || "Azubi"}
                    </span>
                  </p>

                  <div className="mt-4 grid gap-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                    <p>
                      Die Einstufung wird zentral im Nutzerprofil gepflegt und
                      gilt für Forum, Diagnose,
                      Anleitungen, Teilemarkt und Sicherheitsfreigaben.
                    </p>
                    <p>
                      Azubi kann Fragen stellen. Geselle kann zusätzlich
                      antworten. Meister kann zusätzlich richtige Antworten
                      markieren.
                    </p>
                  </div>

                  <a
                    href="/login#nutzerprofil"
                    className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    Im Nutzerprofil verwalten
                  </a>

                  {roleVerificationError && (
                    <p className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
                      {roleVerificationError}
                    </p>
                  )}

                  <div className="mt-5 grid gap-2">
                    {roleVerificationRequests.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Noch kein Qualifikationsnachweis eingereicht.
                      </p>
                    ) : (
                      roleVerificationRequests.slice(0, 4).map((request) => (
                        <div
                          key={request.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                        >
                          <p className="font-black text-slate-950 dark:text-white">
                            {request.requestedRankLabel} ·{" "}
                            {roleVerificationStatusLabel(request.status)}
                          </p>
                          <p className="mt-1 text-slate-600 dark:text-slate-400">
                            {request.documentName} · {formatDate(request.createdAt)}
                          </p>
                          {request.reviewNotes && (
                            <p className="mt-2 text-slate-700 dark:text-slate-300">
                              {request.reviewNotes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">
                    Forum-Punkte
                  </h2>
                  <div className="mt-4 grid gap-3">
                    {leaderboard.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        Noch keine Punkte vorhanden.
                      </p>
                    ) : (
                      leaderboard.map((entry, index) => (
                        <div
                          key={entry.userId}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                        >
                          <div>
                            <p className="font-black text-slate-950 dark:text-white">
                              {index + 1}. {entry.profile?.name || "DiagnoseHUB Nutzer"}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {entry.profile?.rankLabel || "Azubi"}
                            </p>
                          </div>
                          <span className="font-black text-blue-700 dark:text-blue-300">
                            {entry.points}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </aside>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

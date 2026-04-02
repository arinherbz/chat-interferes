import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useData } from "@/lib/data-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, Smartphone, DollarSign, User, AlertCircle, RefreshCw, Scan, 
  ChevronRight, ChevronLeft, AlertTriangle, XCircle, Clock, Shield, 
  Cpu, Battery, Camera, Volume2, Fingerprint, Package, Lock, CheckCircle, Laptop, Monitor,
  Eye, Edit, FileText
} from "lucide-react";
import { Scanner } from "@/components/scanner";
import { FileUploader, type UploadedFileMeta } from "@/components/file-uploader";
import { checkForFakeDevice, type FakeDeviceCheck, detectScanType, validateIMEI as validateScannedIMEI, extractDeviceFromTAC } from "@/lib/scan-utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getTradeInIdentifierLabel, getTradeInIdentifierType, inferTradeInDeviceType, type TradeInDeviceType } from "@shared/trade-in-profile";

interface ConditionOption {
  value: string;
  label: string;
  deduction: number;
  isRejection?: boolean;
}

interface ConditionQuestion {
  id: string;
  category: string;
  question: string;
  options: ConditionOption[];
  sortOrder: number;
  isRequired: boolean;
  isCritical: boolean;
}

interface ConditionProfileResponse {
  profile?: {
    deviceType: TradeInDeviceType;
    source: "shop" | "default" | "builtin";
    questionCount: number;
    warning?: string;
  };
  questions: ConditionQuestion[];
}

interface DeviceBaseValue {
  id: string;
  brand: string;
  model: string;
  storage: string;
  baseValue: number;
}

interface TradeInAssessment {
  id: string;
  tradeInNumber: string;
  brand: string;
  model: string;
  storage: string;
  imei: string;
  customerName: string;
  customerPhone: string;
  baseValue: number;
  conditionScore: number;
  calculatedOffer: number;
  finalOffer: number | null;
  decision: string;
  rejectionReasons: string[] | null;
  status: string;
  payoutMethod: string | null;
  createdAt: string;
  attachments?: UploadedFileMeta[];
}

interface ScoringResult {
  deviceType?: TradeInDeviceType;
  identifierType?: "imei" | "serial";
  baseValue: number;
  conditionScore: number;
  calculatedOffer: number;
  decision: "auto_accept" | "auto_reject" | "manual_review";
  rejectionReasons: string[];
  deductionBreakdown: { question: string; deduction: number }[];
  requiresPricingRule?: boolean;
  reviewMessage?: string;
}

const WIZARD_STEPS = [
  { id: 1, title: "Device", icon: Smartphone, description: "Select device model" },
  { id: 2, title: "Security", icon: Shield, description: "Security checks" },
  { id: 3, title: "Condition", icon: Cpu, description: "Assess condition" },
  { id: 4, title: "Offer", icon: DollarSign, description: "Review offer" },
  { id: 5, title: "Customer", icon: User, description: "Customer details" },
];

const CATEGORY_ICONS: Record<string, any> = {
  security: Shield,
  display: Monitor,
  body: Package,
  functionality: Cpu,
  accessories: Package,
};

const TRADE_IN_DRAFT_STORAGE_KEY = "trade-in-draft";

const normalizeLookupText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]+/g, " ");

const toTitleCase = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const BRAND_ALIASES: Record<string, string> = {
  apple: "Apple",
  iphone: "Apple",
  ipad: "Apple",
  macbook: "Apple",
  imac: "Apple",
  samsung: "Samsung",
  galaxy: "Samsung",
  google: "Google",
  pixel: "Google",
  xiaomi: "Xiaomi",
  redmi: "Xiaomi",
  poco: "Xiaomi",
  mi: "Xiaomi",
  hp: "HP",
  dell: "Dell",
  lenovo: "Lenovo",
  acer: "Acer",
  asus: "ASUS",
  microsoft: "Microsoft",
  surface: "Microsoft",
};

const normalizeStorageValue = (value: string) => {
  const raw = value.trim();
  if (!raw) return "";

  const compact = raw.replace(/\s+/g, "");
  if (/^\d+$/.test(compact)) {
    return `${compact}GB`;
  }
  if (/^\d+gb$/i.test(compact)) {
    return `${compact.slice(0, -2)}GB`;
  }
  if (/^\d+tb$/i.test(compact)) {
    return `${compact.slice(0, -2)}TB`;
  }

  return raw
    .replace(/\bgb\b/gi, "GB")
    .replace(/\btb\b/gi, "TB")
    .replace(/\s+/g, " ")
    .trim();
};

const resolveCanonicalBrand = (
  input: string,
  availableBrands: Array<{ id: string; name: string }>,
  baseValues: DeviceBaseValue[]
) => {
  const normalizedInput = normalizeLookupText(input);
  if (!normalizedInput) return "";

  const allBrandCandidates = [
    ...availableBrands.map((brand) => brand.name),
    ...baseValues.map((value) => value.brand),
  ];

  const exactMatch = allBrandCandidates.find(
    (candidate) => normalizeLookupText(candidate) === normalizedInput
  );
  if (exactMatch) return exactMatch;

  const aliasedBrand = BRAND_ALIASES[normalizedInput];
  if (aliasedBrand) {
    const canonicalMatch = allBrandCandidates.find(
      (candidate) => normalizeLookupText(candidate) === normalizeLookupText(aliasedBrand)
    );
    return canonicalMatch ?? aliasedBrand;
  }

  return toTitleCase(input);
};

const resolveCanonicalModel = (
  input: string,
  canonicalBrand: string,
  availableModels: Array<{ id: string; name: string }>,
  baseValues: DeviceBaseValue[]
) => {
  const normalizedInput = normalizeLookupText(input);
  if (!normalizedInput) return "";

  const brandKey = normalizeLookupText(canonicalBrand);
  const modelCandidates = [
    ...availableModels.map((model) => model.name),
    ...baseValues
      .filter((value) => normalizeLookupText(value.brand) === brandKey)
      .map((value) => value.model),
  ];

  const exactMatch = modelCandidates.find(
    (candidate) => normalizeLookupText(candidate) === normalizedInput
  );
  return exactMatch ?? toTitleCase(input);
};

const resolveCanonicalStorage = (
  input: string,
  canonicalBrand: string,
  canonicalModel: string,
  availableStorages: string[],
  baseValues: DeviceBaseValue[]
) => {
  const normalizedInput = normalizeLookupText(normalizeStorageValue(input));
  if (!normalizedInput) return "";

  const brandKey = normalizeLookupText(canonicalBrand);
  const modelKey = normalizeLookupText(canonicalModel);
  const storageCandidates = [
    ...availableStorages,
    ...baseValues
      .filter(
        (value) =>
          normalizeLookupText(value.brand) === brandKey &&
          normalizeLookupText(value.model) === modelKey
      )
      .map((value) => value.storage),
  ];

  const exactMatch = storageCandidates.find(
    (candidate) => normalizeLookupText(normalizeStorageValue(candidate)) === normalizedInput
  );
  return exactMatch ?? normalizeStorageValue(input);
};

export default function TradeInPage() {
  const { activeShop, currentUser } = useData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
  // Wizard state
  const [step, setStep] = useState(1);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Form state
  const [deviceType, setDeviceType] = useState<TradeInDeviceType | "auto">("auto");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [color, setColor] = useState("");
  const [imei, setImei] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [conditionAnswers, setConditionAnswers] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"Cash" | "MTN" | "Airtel" | "Credit">("Cash");
  
  // Calculated offer state
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);
  const [calculateError, setCalculateError] = useState<string | null>(null);
  
  // UI state
  const [identifierValidation, setIdentifierValidation] = useState<{ valid: boolean; message?: string; error?: string; blocked?: boolean; duplicate?: boolean } | null>(null);
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [isIdentifierValidating, setIsIdentifierValidating] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<TradeInAssessment | null>(null);
  
  // Fake device detection state
  const [fakeDeviceWarning, setFakeDeviceWarning] = useState<FakeDeviceCheck | null>(null);
  const [showFakeDeviceDialog, setShowFakeDeviceDialog] = useState(false);
  const [ownerOverrideReason, setOwnerOverrideReason] = useState("");
  const [scanDetectedDevice, setScanDetectedDevice] = useState<{ brand?: string; model?: string } | null>(null);
  const [attachments, setAttachments] = useState<UploadedFileMeta[]>([]);
  const lastValidationKeyRef = useRef<string | null>(null);

  const resolvedDeviceType = useMemo(
    () =>
      inferTradeInDeviceType({
        deviceType: deviceType === "auto" ? undefined : deviceType,
        brand,
        model,
        storage,
      }),
    [deviceType, brand, model, storage]
  );
  const identifierType = getTradeInIdentifierType(resolvedDeviceType);
  const identifierLabel = getTradeInIdentifierLabel(resolvedDeviceType);
  const identifierValue = identifierType === "imei" ? imei : serialNumber.trim();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resumeTradeIn") !== "1") {
      return;
    }

    const savedDraft = window.sessionStorage.getItem(TRADE_IN_DRAFT_STORAGE_KEY);
    if (!savedDraft) {
      setLocation("/trade-in", { replace: true });
      return;
    }

    try {
      const draft = JSON.parse(savedDraft) as {
        step?: number;
        deviceType?: TradeInDeviceType | "auto";
        brand?: string;
        model?: string;
        storage?: string;
        color?: string;
        imei?: string;
        serialNumber?: string;
        conditionAnswers?: Record<string, string>;
        customerName?: string;
        customerPhone?: string;
        customerEmail?: string;
        payoutMethod?: "Cash" | "MTN" | "Airtel" | "Credit";
      };

      setStep(draft.step && draft.step >= 1 && draft.step <= 5 ? draft.step : 1);
      setDeviceType(draft.deviceType ?? "auto");
      setBrand(draft.brand ?? "");
      setModel(draft.model ?? "");
      setStorage(draft.storage ?? "");
      setColor(draft.color ?? "");
      setImei(draft.imei ?? "");
      setSerialNumber(draft.serialNumber ?? "");
      setConditionAnswers(draft.conditionAnswers ?? {});
      setCustomerName(draft.customerName ?? "");
      setCustomerPhone(draft.customerPhone ?? "");
      setCustomerEmail(draft.customerEmail ?? "");
      setPayoutMethod(draft.payoutMethod ?? "Cash");

      toast({
        title: "Trade-in draft restored",
        description: "Your device details were restored after saving the base value.",
      });
      window.sessionStorage.removeItem(TRADE_IN_DRAFT_STORAGE_KEY);
    } catch {
      window.sessionStorage.removeItem(TRADE_IN_DRAFT_STORAGE_KEY);
    } finally {
      setLocation("/trade-in", { replace: true });
    }
  }, [location, setLocation, toast]);

  // Fetch condition questions
  const { data: questions = [], error: questionsError } = useQuery<ConditionQuestion[]>({
    queryKey: ["/api/trade-in/questions", resolvedDeviceType, activeShop?.id ?? "global"],
    queryFn: async () => {
      const url = `/api/trade-in/questions?deviceType=${resolvedDeviceType}${activeShop?.id ? `&shopId=${encodeURIComponent(activeShop.id)}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load trade-in questions");
      }
      const data = (await response.json()) as ConditionQuestion[] | ConditionProfileResponse;
      return Array.isArray(data) ? data : data.questions;
    },
  });

  // Fetch base values (include shopId so shop-specific values load)
  const { data: baseValues = [] } = useQuery<DeviceBaseValue[]>({
    queryKey: ["trade-in-base-values", activeShop?.id ?? "global"],
    queryFn: async () => {
      const url = `/api/trade-in/base-values${activeShop?.id ? `?shopId=${activeShop.id}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load base values: ${res.status}`);
      return (await res.json()) as DeviceBaseValue[];
    },
    staleTime: Infinity,
  });

  // Fetch assessments
  const { data: assessments = [] } = useQuery<TradeInAssessment[]>({
    queryKey: ["/api/trade-in/assessments"],
  });

  // Fetch normalized brands and models from server, fallback to baseValues-derived lists
  const { data: apiBrands = [], isLoading: brandsLoading } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/brands", activeShop?.id ?? "global"],
    queryFn: async () => {
      const url = `/api/brands${activeShop?.id ? `?shopId=${activeShop.id}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [] as any;
      const json = await res.json();
      // Normalize server responses: could be array of strings or objects
      if (Array.isArray(json) && json.length > 0 && typeof json[0] === "string") {
        return json.map((n: string) => ({ id: n, name: n }));
      }
      return json as { id: string; name: string }[];
    },
    staleTime: Infinity,
  });

  const { data: apiModels = [], isLoading: modelsLoading } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/models", brand, activeShop?.id ?? "global"],
    queryFn: async () => {
      if (!brand) return [] as any;
      // Determine whether brand is an id from apiBrands
      const found = apiBrands.find(b => b.id === brand || b.name === brand);
      let url = "";
      if (found) {
        url = `/api/models?brand_id=${found.id}${activeShop?.id ? `&shopId=${activeShop.id}` : ""}`;
      } else {
        url = `/api/models?brand=${encodeURIComponent(brand)}${activeShop?.id ? `&shopId=${activeShop.id}` : ""}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [] as any;
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0 && typeof json[0] === "string") {
        return json.map((n: string) => ({ id: n, name: n }));
      }
      return json as { id: string; name: string }[];
    },
    enabled: !!brand,
    staleTime: Infinity,
  });

  const { data: apiStorages = [], isLoading: storagesLoading } = useQuery<string[]>({
    queryKey: ["/api/storages", brand, model, activeShop?.id ?? "global"],
    queryFn: async () => {
      if (!model) return [] as any;
      // Try model id from apiModels first
      const foundModel = apiModels.find(m => m.id === model || m.name === model);
      let url = "";
      if (foundModel) {
        url = `/api/storages?model_id=${foundModel.id}${activeShop?.id ? `&shopId=${activeShop.id}` : ""}`;
      } else {
        url = `/api/storages?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}${activeShop?.id ? `&shopId=${activeShop.id}` : ""}`;
      }
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [] as any;
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0 && typeof json[0] === "string") return json;
      // If objects returned, map to size or size property
      if (Array.isArray(json)) return json.map((s: any) => s.size || s);
      return [] as string[];
    },
    enabled: !!model,
    staleTime: Infinity,
  });

  // Fallback derived lists from baseValues
  const fallbackBrands = useMemo(() => {
    const set = new Map<string, string>();
    baseValues.forEach((v) => set.set(v.brand.toLowerCase(), v.brand));
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b)).map(n => ({ id: n, name: n }));
  }, [baseValues]);

  const brandsList = (apiBrands && apiBrands.length > 0) ? apiBrands : fallbackBrands;

  const canonicalBrand = useMemo(
    () => resolveCanonicalBrand(brand, brandsList, baseValues),
    [brand, brandsList, baseValues]
  );

  const fallbackModels = useMemo(() => {
    const set = new Map<string, string>();
    baseValues
      .filter((v) => normalizeLookupText(v.brand) === normalizeLookupText(canonicalBrand))
      .forEach((v) => set.set(v.model.toLowerCase(), v.model));
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b)).map(n => ({ id: n, name: n }));
  }, [baseValues, canonicalBrand]);

  const modelsList = (apiModels && apiModels.length > 0) ? apiModels : fallbackModels;

  const canonicalModel = useMemo(
    () => resolveCanonicalModel(model, canonicalBrand, modelsList, baseValues),
    [model, canonicalBrand, modelsList, baseValues]
  );

  const fallbackStorages = useMemo(() => {
    const set = new Map<string, string>();
    baseValues
      .filter(
        (v) =>
          normalizeLookupText(v.brand) === normalizeLookupText(canonicalBrand) &&
          normalizeLookupText(v.model) === normalizeLookupText(canonicalModel)
      )
      .forEach((v) => set.set(v.storage.toLowerCase(), v.storage));
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [baseValues, canonicalBrand, canonicalModel]);

  const storages = (apiStorages && apiStorages.length > 0) ? apiStorages : fallbackStorages;
  const canonicalStorage = useMemo(
    () => resolveCanonicalStorage(storage, canonicalBrand, canonicalModel, storages, baseValues),
    [storage, canonicalBrand, canonicalModel, storages, baseValues]
  );
  const hasBrandOptions = brandsList.length > 0;
  const hasModelOptions = modelsList.length > 0;
  const hasStorageOptions = storages.length > 0;

  // Get current base value
  const currentBaseValue = useMemo(() => {
    return baseValues.find((value) =>
      normalizeLookupText(value.brand) === normalizeLookupText(canonicalBrand) &&
      normalizeLookupText(value.model) === normalizeLookupText(canonicalModel) &&
      normalizeLookupText(normalizeStorageValue(value.storage)) === normalizeLookupText(canonicalStorage)
    );
  }, [baseValues, canonicalBrand, canonicalModel, canonicalStorage]);

  // Group questions by category
  const questionsByCategory = useMemo(() => {
    const grouped: Record<string, ConditionQuestion[]> = {};
    questions.forEach(q => {
      if (!grouped[q.category]) grouped[q.category] = [];
      grouped[q.category].push(q);
    });
    return grouped;
  }, [questions]);

  const securityQuestions = questionsByCategory.security ?? [];
  const assessmentCategories = Object.entries(questionsByCategory).filter(([category]) => category !== "security");
  const requiredSecurityQuestions = securityQuestions.filter((question) => question.isRequired);
  const requiredAssessmentQuestions = questions.filter((question) => question.isRequired && question.category !== "security");

  const validateIdentifierMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trade-in/validate-identifier", {
        deviceType: resolvedDeviceType,
        imei,
        serialNumber,
      });
      return res.json();
    },
    onMutate: () => {
      setIsIdentifierValidating(true);
    },
    onSuccess: (data) => {
      setIdentifierValidation(data);
      setIsIdentifierValidating(false);
    },
    onError: (error: any) => {
      setIdentifierValidation({
        valid: false,
        message: error?.message || `Unable to validate ${identifierLabel.toLowerCase()}.`,
      });
      setIsIdentifierValidating(false);
    },
  });

  const requestIdentifierValidation = (force = false) => {
    setIdentifierTouched(true);

    if (identifierType === "imei") {
      if (imei.length === 0) {
        setIdentifierValidation(null);
        return;
      }

      if (imei.length < 15) {
        if (force) {
          setIdentifierValidation({ valid: false, message: "IMEI must be 15 digits." });
        }
        return;
      }
    } else {
      if (serialNumber.trim().length === 0) {
        setIdentifierValidation(null);
        return;
      }

      if (serialNumber.trim().length < 4) {
        if (force) {
          setIdentifierValidation({ valid: false, message: "Serial number must be at least 4 characters." });
        }
        return;
      }
    }

    const nextKey = `${resolvedDeviceType}:${identifierType}:${identifierValue}`;
    if (!force && lastValidationKeyRef.current === nextKey) {
      return;
    }

    lastValidationKeyRef.current = nextKey;
    validateIdentifierMutation.mutate();
  };

  // Calculate offer mutation
  const calculateOfferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trade-in/calculate", {
        deviceType: resolvedDeviceType,
        brand: canonicalBrand,
        model: canonicalModel,
        storage: canonicalStorage,
        serialNumber,
        conditionAnswers,
        imei,
      });
      return res.json();
    },
    onMutate: () => {
      setCalculateError(null);
      setScoringResult(null);
    },
    onSuccess: (data) => {
      setScoringResult(data);
      setCalculateError(null);
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to calculate offer";
      setCalculateError(message);
      setScoringResult(null);
      toast({
        title: "Unable to calculate offer",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Submit trade-in mutation
  const submitTradeInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trade-in/submit", {
        deviceType: resolvedDeviceType,
        brand: canonicalBrand,
        model: canonicalModel,
        storage: canonicalStorage,
        color,
        imei,
        serialNumber,
        conditionAnswers,
        customerName,
        customerPhone,
        customerEmail,
        payoutMethod,
        shopId: activeShop?.id,
        processedBy: currentUser?.id,
        processedByName: currentUser?.name,
        attachments,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trade-in/assessments"] });
      
      const decision = data.scoring.decision;
      if (decision === "auto_accept") {
        toast({
          title: "Trade-In Approved!",
          description: `Offer: UGX ${data.scoring.calculatedOffer.toLocaleString()}`,
          className: "bg-green-600 text-white border-none",
        });
      } else if (decision === "auto_reject") {
        toast({
          title: "Trade-In Rejected",
          description: data.scoring.rejectionReasons.join(", "),
          className: "bg-red-600 text-white border-none",
        });
      } else {
        toast({
          title: "Sent for Manual Review",
          description: "A manager will review this trade-in shortly.",
          className: "bg-amber-600 text-white border-none",
        });
      }
      
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit trade-in",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!identifierTouched) {
      return;
    }
    requestIdentifierValidation(false);
  }, [imei, serialNumber, identifierType, resolvedDeviceType]);

  // Calculate offer when moving to step 4
  useEffect(() => {
    if (step === 4 && canonicalBrand && canonicalModel && canonicalStorage) {
      calculateOfferMutation.mutate();
    }
  }, [step, canonicalBrand, canonicalModel, canonicalStorage, serialNumber, resolvedDeviceType]);

  const resetForm = () => {
    setStep(1);
    setDeviceType("auto");
    setBrand("");
    setModel("");
    setStorage("");
    setColor("");
    setImei("");
    setSerialNumber("");
    setConditionAnswers({});
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setPayoutMethod("Cash");
    setScoringResult(null);
    setCalculateError(null);
    setIdentifierValidation(null);
    setIdentifierTouched(false);
    setIsIdentifierValidating(false);
    lastValidationKeyRef.current = null;
    setFakeDeviceWarning(null);
    setScanDetectedDevice(null);
    setOwnerOverrideReason("");
    setAttachments([]);
  };

  // Validation helper before allowing submit
  const ensureWizardValid = () => {
    if (!canonicalBrand || !canonicalModel || !canonicalStorage) {
      toast({ title: "Select device", description: "Choose brand, model, and storage.", variant: "destructive" });
      return false;
    }
    if (!currentBaseValue) {
      toast({
        title: "Missing base value",
        description: "Add a matching trade-in base value before continuing with this buyout.",
        variant: "destructive",
      });
      return false;
    }
    if (identifierType === "imei" && imei.length !== 15) {
      toast({ title: "Invalid IMEI", description: "IMEI must be 15 digits.", variant: "destructive" });
      return false;
    }
    if (identifierType === "serial" && serialNumber.trim().length < 4) {
      toast({ title: "Invalid serial number", description: "Enter a usable serial number.", variant: "destructive" });
      return false;
    }
    if (questions.length === 0) {
      toast({ title: "Condition profile unavailable", description: "The device assessment questions could not be loaded.", variant: "destructive" });
      return false;
    }
    const missingRequired = questions
      .filter(q => q.isRequired)
      .some(q => !conditionAnswers[q.id]);
    if (missingRequired) {
      toast({ title: "Condition answers required", description: "Answer all required condition checks.", variant: "destructive" });
      return false;
    }
    if (!customerName || !customerPhone) {
      toast({ title: "Customer details required", description: "Name and phone are required.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleScanResult = (rawValue: string) => {
    setIsScannerOpen(false);
    const detection = detectScanType(rawValue);
    const cleanedValue = detection.value.replace(/\D/g, "");
    const imeiValue = cleanedValue.slice(0, 15);
    const validation = detection.type === "imei" ? validateScannedIMEI(imeiValue) : { valid: true };
    const deviceInfo = detection.type === "imei" ? extractDeviceFromTAC(imeiValue) : undefined;

    if (detection.type === "imei" && imeiValue.length === 15) {
      setDeviceType("phone");
      setImei(imeiValue);
      setIdentifierTouched(true);
      lastValidationKeyRef.current = null;

      if (deviceInfo?.brand) {
        setScanDetectedDevice({
          brand: deviceInfo.brand,
          model: deviceInfo.model,
        });

        const detectedBrand = deviceInfo.brand;
        if (detectedBrand && brandsList.some(b => b.name === detectedBrand)) {
          setBrand(detectedBrand);
          setModel("");
          setStorage("");

          if (deviceInfo.model) {
            // Prefer modelsList from API if available, otherwise derive from baseValues
            const availableModels = (modelsList && modelsList.length > 0)
              ? modelsList.map(m => m.name)
              : baseValues.filter((v) => v.brand === detectedBrand).map((v) => v.model);
            const matchingModel = availableModels.find((m) =>
              m.toLowerCase().includes(deviceInfo.model!.toLowerCase().split(" ").pop() || "")
            );
            if (matchingModel) {
              setModel(matchingModel);
            }
          }

          toast({
            title: "Device Detected",
            description: `Auto-filled: ${detectedBrand}${deviceInfo.model ? ` ${deviceInfo.model}` : ""}`,
            className: "bg-blue-600 text-white border-none",
          });
        }
      }

      if (!validation.valid) {
        toast({
          title: "Warning",
          description: validation.error,
          variant: "destructive",
        });
      }

      toast({ title: "IMEI Scanned", description: `IMEI: ${imeiValue}` });
      return;
    }

    if (detection.type === "serial") {
      setDeviceType("laptop");
      setSerialNumber(detection.value.trim());
      setIdentifierTouched(true);
      lastValidationKeyRef.current = null;
      toast({
        title: "Serial Number Scanned",
        description: "Serial number captured for laptop or non-phone intake.",
      });
      return;
    }

    toast({
      title: "Unknown Format",
      description: "Could not detect IMEI. Please enter manually.",
      variant: "destructive",
    });
  };

  const checkFakeDevice = () => {
    if (imei && canonicalBrand && canonicalModel) {
      const result = checkForFakeDevice(imei, undefined, canonicalBrand, canonicalModel);
      setFakeDeviceWarning(result);
      if (result.isSuspicious && result.severity !== "low") {
        setShowFakeDeviceDialog(true);
      }
    }
  };

  const handleOwnerOverride = () => {
    toast({
      title: "Override Confirmed",
      description: `Proceeding despite warnings. Reason: ${ownerOverrideReason}`,
      className: "bg-amber-600 text-white border-none",
    });
    setShowFakeDeviceDialog(false);
    nextStep();
  };

  const deviceBasicsReady = !!canonicalBrand && !!canonicalModel && !!canonicalStorage;
  const identifierEntered = identifierType === "imei" ? imei.length > 0 : serialNumber.trim().length > 0;
  const hasValidIdentifier = identifierType === "imei"
    ? imei.length === 15 && !!identifierValidation?.valid
    : serialNumber.trim().length >= 4 && !!identifierValidation?.valid;
  const pricingReady = !!currentBaseValue;
  const canManageBaseValues = currentUser?.role === "Owner" || currentUser?.role === "Manager";
  const canContinueWithoutPricing = canManageBaseValues && deviceBasicsReady && hasValidIdentifier;
  const canProceedStep1 = deviceBasicsReady && hasValidIdentifier && (pricingReady || canContinueWithoutPricing);
  const canProceedStep2 = securityQuestions.length > 0 && requiredSecurityQuestions.every((question) => !!conditionAnswers[question.id]);
  const canProceedStep3 = assessmentCategories.length > 0 && requiredAssessmentQuestions.every((question) => !!conditionAnswers[question.id]);
  const canProceedStep4 = scoringResult !== null;
  const canProceedStep5 = customerName && customerPhone;
  const showCatalogHelper = !hasBrandOptions && !brand;
  const showPricingReadiness = deviceBasicsReady;
  const showIdentifierHint = identifierTouched || identifierEntered;
  const shouldShowFakeWarning = !!fakeDeviceWarning?.isSuspicious && step > 1;

  const step1HelperText = (() => {
    if (!canonicalBrand || !canonicalModel || !canonicalStorage) {
      return "Complete the device basics first.";
    }
    if (!hasValidIdentifier) {
      return `Validate the ${identifierLabel.toLowerCase()} to continue.`;
    }
    if (!currentBaseValue) {
      return canManageBaseValues
        ? "Pricing rule is missing. You can continue to intake and send this device for manual review, or save the pricing rule now."
        : "Ask a manager to add the missing pricing rule before continuing.";
    }
    return "Device intake is ready for assessment.";
  })();

  const conditionProfileMessage = questionsError
    ? "Condition checks are temporarily unavailable. Refresh the page or ask an admin to verify the profile setup."
    : questions.length === 0
      ? "No condition profile is configured for this device yet. The intake can continue only after a profile is available."
      : null;

  const ruleStatuses = [
    {
      label: "Ownership or management lock",
      status: securityQuestions.length === 0 ? "pending" : securityQuestions.some((question) => {
        const answer = conditionAnswers[question.id];
        return !!question.options.find((option) => option.value === answer && option.isRejection);
      }) ? "failed" : requiredSecurityQuestions.every((question) => !!conditionAnswers[question.id]) ? "passed" : "pending",
    },
    {
      label: "Primary identifier valid",
      status: !identifierEntered ? "pending" : hasValidIdentifier ? "passed" : (identifierTouched ? "failed" : "pending"),
    },
    {
      label: "Duplicate identifier check",
      status: !identifierEntered || !identifierValidation ? "pending" : (identifierValidation.duplicate || identifierValidation.blocked) ? "failed" : identifierValidation.valid ? "passed" : "pending",
    },
    {
      label: "Pricing rule ready",
      status: !deviceBasicsReady ? "pending" : currentBaseValue ? "passed" : "failed",
    },
    {
      label: "Condition threshold met",
      status: !scoringResult ? "pending" : scoringResult.decision === "auto_reject" ? "failed" : "passed",
    },
  ] as const;

  const openBaseValueShortcut = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        TRADE_IN_DRAFT_STORAGE_KEY,
        JSON.stringify({
          step,
          deviceType,
          brand,
          model,
          storage,
          color,
          imei,
          serialNumber,
          conditionAnswers,
          customerName,
          customerPhone,
          customerEmail,
          payoutMethod,
        })
      );
    }

    const params = new URLSearchParams({
      brand: canonicalBrand,
      model: canonicalModel,
      storage: canonicalStorage,
      deviceType: resolvedDeviceType,
      returnTo: "/trade-in",
    });
    setLocation(`/base-values?${params.toString()}`);
  };

  const nextStep = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleStep1Next = () => {
    const fakeCheck = checkForFakeDevice(imei, undefined, canonicalBrand, canonicalModel);
    setFakeDeviceWarning(fakeCheck);
    
    if (fakeCheck.isSuspicious && fakeCheck.severity !== "low") {
      setShowFakeDeviceDialog(true);
    } else {
      nextStep();
    }
  };
  
  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = () => {
    if (!ensureWizardValid()) return;
    submitTradeInMutation.mutate();
  };

  const getDecisionBadge = (decision: string, status: string) => {
    if (status === "completed") {
      return <Badge className="tone-success">Completed</Badge>;
    }
    switch (decision) {
      case "auto_accept":
      case "accepted":
        return <Badge className="tone-success">Approved</Badge>;
      case "auto_reject":
      case "rejected":
        return <Badge className="tone-danger">Rejected</Badge>;
      case "manual_review":
        return <Badge className="tone-warning">Pending Review</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="page-shell" data-testid="page-trade-in">
      <div className="page-hero flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="page-kicker">Buyback Workflow</div>
          <h1 className="page-title">Trade-In Center</h1>
          <p className="page-subtitle">Process device buybacks with a cleaner multi-step assessment flow, clearer guardrails, and calmer review states.</p>
        </div>
      </div>

      <Tabs defaultValue="new" className="space-y-6">
        <TabsList className="surface-muted p-1">
          <TabsTrigger value="new" data-testid="tab-new-tradein">New Trade-In</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History ({assessments.length})</TabsTrigger>
          <TabsTrigger value="values" data-testid="tab-values">Base Values</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          {/* Progress Steps */}
          <div className="surface-panel mb-8 flex items-center justify-between p-6">
            {WIZARD_STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              
              return (
                <div key={s.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isCompleted ? "bg-primary text-white" :
                        isActive ? "bg-primary text-white" :
                        "bg-secondary/85 text-muted-foreground"
                      }`}
                      data-testid={`step-indicator-${s.id}`}
                    >
                      {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {s.title}
                    </span>
                  </div>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={`mx-2 h-0.5 w-16 ${step > s.id ? "bg-primary/60" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_340px]">
            {/* Main Wizard Card */}
            <Card className="surface-panel">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                    {step}
                  </div>
                  {WIZARD_STEPS[step - 1]?.title}
                </CardTitle>
                <CardDescription>{WIZARD_STEPS[step - 1]?.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="min-h-[400px]">
                {/* Step 1: Device Selection */}
                {step === 1 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <section className="space-y-4 rounded-[1.5rem] border border-border/70 bg-white/98 p-5 shadow-[0_16px_32px_rgba(24,38,31,0.04)]">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Step 1. Device basics</h3>
                        <p className="mt-1 text-sm text-slate-500">Choose the device profile, then enter the exact brand, model, and storage for intake.</p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Device Type</Label>
                          <Select value={deviceType} onValueChange={(value) => setDeviceType(value as TradeInDeviceType | "auto")}>
                            <SelectTrigger data-testid="select-device-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">Auto detect</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                              <SelectItem value="tablet">Tablet</SelectItem>
                              <SelectItem value="laptop">Laptop</SelectItem>
                              <SelectItem value="other">Other device</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="rounded-[1.15rem] border border-border/70 bg-secondary/72 p-4">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            {resolvedDeviceType === "laptop" ? <Laptop className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                            Assessment profile
                          </div>
                          <p className="mt-1 text-sm capitalize text-slate-600">{resolvedDeviceType} workflow</p>
                          <p className="mt-1 text-xs text-slate-500">Identifier checks and question sets adjust automatically for this device type.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Brand</Label>
                          {hasBrandOptions ? (
                            <SearchableSelect
                              options={brandsList.map((b) => ({ value: b.name, label: b.name }))}
                              value={brand}
                              onValueChange={(v) => { setBrand(v); setModel(""); setStorage(""); }}
                              placeholder="Select brand"
                              searchPlaceholder="Search brands..."
                              emptyMessage="Brand not listed? Enter it manually."
                              data-testid="select-brand"
                            />
                          ) : (
                            <Input
                              placeholder="Enter brand, e.g. Apple, Dell, HP"
                              value={brand}
                              onChange={(e) => { setBrand(e.target.value); setModel(""); setStorage(""); }}
                              onBlur={() => {
                                if (canonicalBrand && canonicalBrand !== brand) {
                                  setBrand(canonicalBrand);
                                }
                              }}
                              data-testid="input-brand"
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Model</Label>
                          {hasModelOptions ? (
                            <SearchableSelect
                              options={modelsList.map((m) => ({ value: m.name, label: m.name }))}
                              value={model}
                              onValueChange={(v) => { setModel(v); setStorage(""); }}
                              placeholder="Select model"
                              searchPlaceholder="Search models..."
                              emptyMessage="Model not listed? Enter it manually."
                              disabled={!brand}
                              data-testid="select-model"
                            />
                          ) : (
                            <Input
                              placeholder="Enter model, e.g. MacBook Pro 14, Latitude 5420"
                              value={model}
                              onChange={(e) => { setModel(e.target.value); setStorage(""); }}
                              onBlur={() => {
                                if (canonicalModel && canonicalModel !== model) {
                                  setModel(canonicalModel);
                                }
                              }}
                              disabled={!brand}
                              data-testid="input-model"
                            />
                          )}
                        </div>
                      </div>

                      {showCatalogHelper && (
                        <div className="rounded-[1.15rem] border border-border/70 bg-secondary/72 p-4">
                          <p className="text-sm font-medium text-slate-900">Brand not found in saved catalog?</p>
                          <p className="mt-1 text-sm text-slate-600">Manual entry is available here. Enter the brand and model directly, then continue to pricing readiness.</p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Storage</Label>
                          {hasStorageOptions ? (
                            <SearchableSelect
                              options={storages.map((s) => ({ value: s, label: s }))}
                              value={storage}
                              onValueChange={setStorage}
                              placeholder="Select storage"
                              searchPlaceholder="Search storage..."
                              emptyMessage="Storage not listed? Enter it manually."
                              disabled={!model}
                              data-testid="select-storage"
                            />
                          ) : (
                            <Input
                              placeholder="Enter storage/spec, e.g. 256GB, 16GB/512GB"
                              value={storage}
                              onChange={(e) => setStorage(e.target.value)}
                              onBlur={() => {
                                if (canonicalStorage && canonicalStorage !== storage) {
                                  setStorage(canonicalStorage);
                                }
                              }}
                              disabled={!model}
                              data-testid="input-storage"
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Color (Optional)</Label>
                          <Input
                            placeholder="e.g. Space Gray"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            data-testid="input-color"
                          />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4 rounded-[1.5rem] border border-border/70 bg-white/98 p-5 shadow-[0_16px_32px_rgba(24,38,31,0.04)]">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Step 2. Identification</h3>
                        <p className="mt-1 text-sm text-slate-500">Scan or enter the main identifier. Validation runs after scan, Enter, blur, or when the entry is complete.</p>
                      </div>

                      <div className="space-y-2">
                        <Label>{identifierLabel}</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            {identifierType === "imei" ? (
                              <Input
                                placeholder="Enter 15-digit IMEI"
                                value={imei}
                                onChange={(e) => {
                                  const nextValue = e.target.value.replace(/\D/g, "").slice(0, 15);
                                  setImei(nextValue);
                                  setIdentifierTouched((prev) => prev || nextValue.length === 15);
                                  lastValidationKeyRef.current = null;
                                }}
                                onBlur={() => requestIdentifierValidation(true)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    requestIdentifierValidation(true);
                                  }
                                }}
                                className={showIdentifierHint && identifierValidation ? (identifierValidation.valid ? "border-green-500" : "border-red-500") : ""}
                                data-testid="input-imei"
                              />
                            ) : (
                              <Input
                                placeholder="Enter serial number"
                                value={serialNumber}
                                onChange={(e) => {
                                  const nextValue = e.target.value.trimStart();
                                  setSerialNumber(nextValue);
                                  setIdentifierTouched((prev) => prev || nextValue.trim().length >= 4);
                                  lastValidationKeyRef.current = null;
                                }}
                                onBlur={() => requestIdentifierValidation(true)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    requestIdentifierValidation(true);
                                  }
                                }}
                                className={showIdentifierHint && identifierValidation ? (identifierValidation.valid ? "border-green-500" : "border-red-500") : ""}
                                data-testid="input-serial-number"
                              />
                            )}
                            {isIdentifierValidating ? (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
                              </div>
                            ) : showIdentifierHint && identifierValidation ? (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {identifierValidation.valid ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-red-500" />
                                )}
                              </div>
                            ) : null}
                          </div>
                          <Button type="button" variant="outline" size="icon" onClick={() => setIsScannerOpen(true)} data-testid="btn-scan-imei">
                            <Scan className="h-4 w-4" />
                          </Button>
                        </div>
                        {showIdentifierHint && identifierValidation && !identifierValidation.valid ? (
                          <p className="flex items-center gap-1 text-sm text-red-500">
                            <AlertCircle className="h-4 w-4" />
                            {identifierValidation.message ?? identifierValidation.error}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">Scanner and manual entry follow the same validation path.</p>
                        )}
                      </div>
                    </section>

                    <section className="space-y-4 rounded-[1.5rem] border border-border/70 bg-white/98 p-5 shadow-[0_16px_32px_rgba(24,38,31,0.04)]">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">Step 3. Pricing readiness</h3>
                        <p className="mt-1 text-sm text-slate-500">The system checks for a pricing rule only after the device basics are complete.</p>
                      </div>

                      {!showPricingReadiness ? (
                        <div className="rounded-[1.15rem] border border-border/70 bg-secondary/72 p-4 text-sm text-slate-600">
                          Complete brand, model, and storage to check pricing readiness.
                        </div>
                      ) : currentBaseValue ? (
                        <div className="rounded-[1.15rem] border border-primary/20 bg-primary/8 p-4">
                          <p className="text-sm font-medium text-primary">Pricing rule found</p>
                          <p className="mt-1 text-sm text-primary/85">{canonicalBrand} {canonicalModel} {canonicalStorage} is ready for assessment.</p>
                          <p className="mt-2 text-sm text-primary">Base value: <strong>UGX {currentBaseValue.baseValue.toLocaleString()}</strong></p>
                        </div>
                      ) : (
                        <div className="rounded-[1.15rem] border border-orange-200 bg-orange-50/85 p-4">
                          <p className="text-sm font-medium text-orange-900">Pricing rule missing</p>
                          <p className="mt-1 text-sm text-orange-700">No pricing rule is saved yet for {canonicalBrand} {canonicalModel} {canonicalStorage}.</p>
                          <p className="mt-1 text-xs text-orange-700">
                            {canManageBaseValues
                              ? "You can continue this intake as manual review, or open Base Values and save the missing combination now."
                              : "Ask a manager to add the missing pricing rule before continuing."}
                          </p>
                          {canManageBaseValues && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={openBaseValueShortcut}>
                                Add base value for this device
                              </Button>
                              <Badge variant="secondary">Manual review allowed</Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </section>

                    {scanDetectedDevice && (
                      <div className="rounded-[1.15rem] border border-slate-200 bg-slate-50 p-4 text-slate-700" data-testid="detected-device-autofill">
                        <p className="text-sm">
                          <strong>Scan detection:</strong> {scanDetectedDevice.brand}
                          {scanDetectedDevice.model && ` ${scanDetectedDevice.model}`}
                        </p>
                        <p className="mt-1 text-xs">Device details were pre-filled from the scanned identifier.</p>
                      </div>
                    )}

                    {shouldShowFakeWarning && (
                      <div className={`p-4 rounded-lg border ${
                        fakeDeviceWarning.severity === "high" ? "bg-rose-50 border-rose-200" :
                        fakeDeviceWarning.severity === "medium" ? "bg-amber-50 border-amber-200" :
                        "bg-yellow-50 border-yellow-200"
                      }`} data-testid="fake-device-warning">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                            fakeDeviceWarning.severity === "high" ? "text-red-600" :
                            fakeDeviceWarning.severity === "medium" ? "text-amber-600" :
                            "text-yellow-600"
                          }`} />
                          <div>
                            <p className={`text-sm font-medium ${
                              fakeDeviceWarning.severity === "high" ? "text-red-800" :
                              fakeDeviceWarning.severity === "medium" ? "text-amber-800" :
                              "text-yellow-800"
                            }`}>
                              Suspicious Device Detected
                            </p>
                            <ul className="text-xs mt-1 space-y-1">
                              {fakeDeviceWarning.reasons.map((reason, i) => (
                                <li key={i} className={
                                  fakeDeviceWarning.severity === "high" ? "text-red-600" :
                                  fakeDeviceWarning.severity === "medium" ? "text-amber-600" :
                                  "text-yellow-600"
                                }>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}

                    <Scanner 
                      open={isScannerOpen}
                      onClose={() => setIsScannerOpen(false)}
                      onDetected={handleScanResult}
                      title="Scan IMEI / QR"
                    />
                  </div>
                )}

                {/* Step 2: Security Checks */}
                {step === 2 && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="rounded-[1.5rem] border border-border/70 bg-secondary/72 p-6">
                      <div className="flex items-start gap-3">
                        <Shield className="w-6 h-6 text-slate-600 mt-0.5" />
                        <div>
                          <h3 className="font-semibold text-slate-900">Security checks</h3>
                          <p className="text-sm text-slate-600 mt-1">
                            Confirm ownership and lock status before the condition assessment.
                          </p>
                        </div>
                      </div>
                    </div>

                    {conditionProfileMessage ? (
                      <div className="surface-muted flex items-start gap-3 p-4">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-orange-600" />
                        <p className="text-sm text-slate-700">{conditionProfileMessage}</p>
                      </div>
                    ) : null}

                    <div className="space-y-6">
                      {securityQuestions.map((question) => (
                        <div key={question.id} className="surface-muted p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <Lock className="w-5 h-5 text-slate-600" />
                            <span className="font-medium">{question.question}</span>
                          </div>
                          <RadioGroup
                            value={conditionAnswers[question.id] || ""}
                            onValueChange={(value) => setConditionAnswers({ ...conditionAnswers, [question.id]: value })}
                            className="space-y-2"
                          >
                            {question.options.map((option) => (
                              <div key={option.value} className="flex items-center space-x-2">
                                <RadioGroupItem
                                  value={option.value}
                                  id={`${question.id}-${option.value}`}
                                  data-testid={`radio-${question.id}-${option.value}`}
                                />
                                <Label
                                  htmlFor={`${question.id}-${option.value}`}
                          className={option.isRejection ? "text-rose-700 font-medium" : "text-slate-700"}
                                >
                                  {option.label}
                                  {option.isRejection && <span className="ml-2 text-xs text-rose-500">(Auto-reject)</span>}
                                </Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: Condition Assessment */}
                {step === 3 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    {conditionProfileMessage ? (
                      <div className="surface-muted flex items-start gap-3 p-4">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-orange-600" />
                        <p className="text-sm text-slate-700">{conditionProfileMessage}</p>
                      </div>
                    ) : null}

                    <ScrollArea className="h-[400px] pr-4">
                      {assessmentCategories.map(([category, categoryQuestions]) => {
                        const Icon = CATEGORY_ICONS[category] || Cpu;
                        return (
                          <div key={category} className="mb-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Icon className="w-5 h-5 text-primary" />
                              <h3 className="font-semibold capitalize">{category}</h3>
                            </div>
                            <div className="space-y-4 pl-7">
                              {categoryQuestions.map((q) => (
                                <div key={q.id} className="surface-muted p-4">
                                  <p className="font-medium text-sm mb-3">{q.question}</p>
                                  <RadioGroup 
                                    value={conditionAnswers[q.id] || ""}
                                    onValueChange={(v) => setConditionAnswers({ ...conditionAnswers, [q.id]: v })}
                                    className="space-y-2"
                                  >
                                    {(q.options as ConditionOption[]).map((opt) => (
                                      <div key={opt.value} className="flex items-center space-x-2">
                                        <RadioGroupItem 
                                          value={opt.value} 
                                          id={`${q.id}-${opt.value}`}
                                          data-testid={`radio-${q.id}-${opt.value}`}
                                        />
                                        <Label 
                                          htmlFor={`${q.id}-${opt.value}`}
                                          className={`text-sm ${opt.isRejection ? "text-rose-700" : opt.deduction > 20 ? "text-orange-700" : ""}`}
                                        >
                                          {opt.label}
                                          {opt.deduction > 0 && !opt.isRejection && (
                                            <span className="text-xs text-slate-500 ml-2">(-{opt.deduction}%)</span>
                                          )}
                                          {opt.isRejection && (
                                            <span className="text-xs text-rose-500 ml-2">(Auto-reject)</span>
                                          )}
                                        </Label>
                                      </div>
                                    ))}
                                  </RadioGroup>
                                </div>
                              ))}
                            </div>
                            <Separator className="mt-6" />
                          </div>
                        );
                      })}
                    </ScrollArea>
                    
                    <div className="surface-muted flex items-center justify-between p-4">
                      <span className="text-sm text-muted-foreground">
                        Questions answered: {requiredAssessmentQuestions.filter((question) => !!conditionAnswers[question.id]).length} / {requiredAssessmentQuestions.length}
                      </span>
                      <Progress 
                        value={(requiredAssessmentQuestions.filter((question) => !!conditionAnswers[question.id]).length / Math.max(1, requiredAssessmentQuestions.length)) * 100} 
                        className="w-32"
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Offer Review */}
                {step === 4 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    {calculateOfferMutation.isPending ? (
                      <div className="flex items-center justify-center h-48">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      </div>
                    ) : scoringResult ? (
                      <>
                        {/* Decision Banner */}
                        <div className={`rounded-[1.35rem] border p-6 ${
                          scoringResult.decision === "auto_accept" ? "border-primary/20 bg-primary/8" :
                          scoringResult.decision === "auto_reject" ? "bg-rose-50 border-rose-300" :
                          "bg-orange-50 border-orange-200"
                        }`}>
                          <div className="flex items-center gap-4">
                            {scoringResult.decision === "auto_accept" && <CheckCircle2 className="w-12 h-12 text-primary" />}
                            {scoringResult.decision === "auto_reject" && <XCircle className="w-12 h-12 text-red-600" />}
                            {scoringResult.decision === "manual_review" && <Clock className="w-12 h-12 text-orange-600" />}
                            <div>
                              <h3 className={`text-xl font-bold ${
                                scoringResult.decision === "auto_accept" ? "text-primary" :
                                scoringResult.decision === "auto_reject" ? "text-red-800" :
                                "text-orange-800"
                              }`}>
                                {scoringResult.decision === "auto_accept" && "Trade-In Approved!"}
                                {scoringResult.decision === "auto_reject" && "Trade-In Rejected"}
                                {scoringResult.decision === "manual_review" && "Manual Review Required"}
                              </h3>
                              <p className="text-sm mt-1">
                                {scoringResult.decision === "auto_accept" && "Device meets our quality standards."}
                                {scoringResult.decision === "auto_reject" && scoringResult.rejectionReasons.join(", ")}
                                {scoringResult.decision === "manual_review" && (scoringResult.reviewMessage || "A manager will review this trade-in.")}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Offer Amount */}
                        <div className="rounded-[1.35rem] border border-border/70 bg-white p-8 text-center shadow-[0_16px_32px_rgba(24,38,31,0.04)]">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {scoringResult.requiresPricingRule ? "Pricing Review" : "Trade-In Value"}
                          </p>
                          {scoringResult.requiresPricingRule ? (
                            <>
                              <div className="mb-2 text-3xl font-bold text-slate-900">Offer pending manual review</div>
                              <div className="text-sm text-slate-500">Condition score recorded. A manager needs to set pricing before approval.</div>
                            </>
                          ) : (
                            <>
                              <div className="mb-2 text-5xl font-bold text-slate-900">
                                UGX {scoringResult.calculatedOffer.toLocaleString()}
                              </div>
                              <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
                                <span>Base: UGX {scoringResult.baseValue.toLocaleString()}</span>
                                <span>|</span>
                                <span>Score: {scoringResult.conditionScore}%</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Deduction Breakdown */}
                        {scoringResult.deductionBreakdown.length > 0 && (
                          <div className="rounded-[1.1rem] border border-border/70 p-4">
                            <h4 className="font-medium mb-3">Condition Deductions</h4>
                            <div className="space-y-2">
                              {scoringResult.deductionBreakdown.map((d, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                  <span className="text-slate-600">{d.question}</span>
                                  <span className="text-red-600 font-medium">-{d.deduction}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Device Summary */}
                        <div className="rounded-[1.1rem] bg-secondary/72 p-4">
                          <h4 className="font-medium mb-3">Device Summary</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-slate-500">Type:</span> <span className="capitalize">{resolvedDeviceType}</span></div>
                            <div><span className="text-slate-500">Brand:</span> {brand}</div>
                            <div><span className="text-slate-500">Model:</span> {model}</div>
                            <div><span className="text-slate-500">Storage:</span> {storage}</div>
                            <div><span className="text-slate-500">{identifierType === "imei" ? "IMEI" : "Serial"}:</span> {identifierType === "imei" ? imei : serialNumber}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-[1.35rem] border border-orange-200 bg-orange-50/85 p-6 text-center">
                        <p className="font-semibold text-orange-800">Unable to calculate offer</p>
                        <p className="mt-2 text-sm text-amber-700">
                          {calculateError || "Add a matching base value and complete the required checks before continuing."}
                        </p>
                        {!currentBaseValue && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs text-orange-700">
                              This device does not have a saved base value yet.
                            </p>
                            {canManageBaseValues && (
                              <Button type="button" variant="outline" size="sm" onClick={openBaseValueShortcut}>
                                Add base value for this device
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5: Customer Details */}
                {step === 5 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Customer Name *</Label>
                        <Input 
                          placeholder="Full name" 
                          value={customerName} 
                          onChange={(e) => setCustomerName(e.target.value)}
                          data-testid="input-customer-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone Number *</Label>
                        <Input 
                          placeholder="077..." 
                          value={customerPhone} 
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          data-testid="input-customer-phone"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Email (Optional)</Label>
                      <Input 
                        placeholder="email@example.com" 
                        type="email"
                        value={customerEmail} 
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        data-testid="input-customer-email"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Payout Method</Label>
                      <Select value={payoutMethod} onValueChange={(v: any) => setPayoutMethod(v)}>
                        <SelectTrigger data-testid="select-payout-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                          <SelectItem value="Airtel">Airtel Money</SelectItem>
                          <SelectItem value="Credit">Store Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Photos &amp; Receipts (optional)</Label>
                      <p className="text-xs text-slate-500">
                        Snap device condition, proof of ID, or receipt. Mobile-friendly and saves instantly.
                      </p>
                      <FileUploader value={attachments} onChange={setAttachments} />
                    </div>

                    {/* Final Summary */}
                    <div className="rounded-[1.35rem] border border-primary/20 bg-primary/8 p-6">
                      <h4 className="mb-4 font-semibold text-primary">Trade-In Summary</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Device</p>
                          <p className="font-medium">{brand} {model} ({storage})</p>
                        </div>
                        <div>
                          <p className="text-slate-500">{identifierType === "imei" ? "IMEI" : "Serial"}</p>
                          <p className="font-medium">{identifierType === "imei" ? imei : serialNumber}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Condition Score</p>
                          <p className="font-medium">{scoringResult?.conditionScore}%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Offer Amount</p>
                          <p className="text-lg font-bold text-primary">
                            {scoringResult?.requiresPricingRule ? "Manual review" : `UGX ${scoringResult?.calculatedOffer.toLocaleString()}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-between border-t border-border/70 pt-6">
                <Button 
                  variant="outline" 
                  onClick={prevStep} 
                  disabled={step === 1}
                  data-testid="btn-prev-step"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                
                {step < 5 ? (
                  <div className="flex flex-col items-end gap-2">
                    {step === 1 && !canProceedStep1 && (
                      <p className="text-xs text-slate-500">{step1HelperText}</p>
                    )}
                    <Button 
                      onClick={step === 1 ? handleStep1Next : nextStep}
                      disabled={
                        (step === 1 && !canProceedStep1) ||
                        (step === 2 && !canProceedStep2) ||
                        (step === 3 && !canProceedStep3) ||
                        (step === 4 && !canProceedStep4)
                      }
                      data-testid="btn-next-step"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={handleSubmit}
                    disabled={!canProceedStep5 || submitTradeInMutation.isPending}
                    data-testid="btn-submit-tradein"
                  >
                    {submitTradeInMutation.isPending ? "Processing..." : "Complete Trade-In"}
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card className="border-border/70 bg-white/96 shadow-[0_16px_34px_rgba(24,38,31,0.055)]">
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {resolvedDeviceType === "laptop" ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                    Intake readiness
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Device basics</span>
                    <Badge variant={deviceBasicsReady ? "default" : "outline"}>{deviceBasicsReady ? "Ready" : "Pending"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">{identifierLabel}</span>
                    <Badge variant={hasValidIdentifier ? "default" : "outline"}>
                      {hasValidIdentifier ? "Validated" : identifierEntered ? "Needs check" : "Pending"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Pricing rule</span>
                    <Badge variant={pricingReady ? "default" : "secondary"}>
                      {pricingReady ? "Found" : showPricingReadiness ? "Missing" : "Pending"}
                    </Badge>
                  </div>
                  <div className="rounded-[1rem] bg-secondary/72 p-3 text-xs text-slate-600">
                    {step1HelperText}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Trade-Ins */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Recent Trade-Ins
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {assessments.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">
                      No trade-ins yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {assessments.slice(0, 5).map(a => (
                        <div 
                          key={a.id} 
                          className="p-4 hover:bg-slate-50 cursor-pointer"
                          onClick={() => { setSelectedAssessment(a); setShowReviewDialog(true); }}
                          data-testid={`tradein-item-${a.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{a.brand} {a.model}</p>
                              <p className="text-xs text-slate-500">{a.tradeInNumber}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-slate-700">
                                UGX {(a.finalOffer || a.calculatedOffer).toLocaleString()}
                              </span>
                              <div className="mt-1">
                                {getDecisionBadge(a.decision, a.status)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Policy Reminder */}
              <Card className="border-border/70 bg-white/96 shadow-[0_16px_34px_rgba(24,38,31,0.055)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm text-slate-900">
                    <AlertCircle className="w-4 h-4" />
                    Rule Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-slate-600">
                  {ruleStatuses.map((rule) => (
                    <div key={rule.label} className="flex items-center justify-between gap-3">
                      <span>{rule.label}</span>
                      <div className="flex items-center gap-2">
                        {rule.status === "pending" && <Clock className="w-4 h-4 text-slate-400" />}
                        {rule.status === "passed" && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {rule.status === "failed" && <XCircle className="w-4 h-4 text-rose-500" />}
                        <span className={`text-xs font-medium ${
                          rule.status === "failed" ? "text-rose-600" : rule.status === "passed" ? "text-emerald-600" : "text-slate-500"
                        }`}>
                          {rule.status === "pending" ? "Pending" : rule.status === "passed" ? "Clear" : "Triggered"}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Trade-In History</CardTitle>
              <CardDescription>All processed trade-in assessments</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trade-In #</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map(a => (
                    <TableRow key={a.id} data-testid={`history-row-${a.id}`}>
                      <TableCell className="font-mono text-sm">{a.tradeInNumber}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{a.brand} {a.model}</p>
                          <p className="text-xs text-slate-500">{a.storage}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{a.customerName}</p>
                          <p className="text-xs text-slate-500">{a.customerPhone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{a.conditionScore}%</Badge>
                      </TableCell>
                      <TableCell className="font-bold">
                        UGX {(a.finalOffer || a.calculatedOffer).toLocaleString()}
                      </TableCell>
                      <TableCell>{getDecisionBadge(a.decision, a.status)}</TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {(a.attachments?.length ?? 0) > 0 ? `${a.attachments?.length} file(s)` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {format(new Date(a.createdAt), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => { setSelectedAssessment(a); setShowReviewDialog(true); }}
                          data-testid={`btn-view-${a.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="values">
          <Card>
            <CardHeader>
              <CardTitle>Device Base Values</CardTitle>
              <CardDescription>Configure trade-in base values for each device model</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Base Value</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {baseValues.map(v => (
                    <TableRow key={v.id} data-testid={`value-row-${v.id}`}>
                      <TableCell className="font-medium">{v.brand}</TableCell>
                      <TableCell>{v.model}</TableCell>
                      <TableCell>{v.storage}</TableCell>
                      <TableCell className="font-bold">UGX {v.baseValue.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50">Active</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assessment Detail Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Trade-In Details</DialogTitle>
            <DialogDescription>
              {selectedAssessment?.tradeInNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedAssessment && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Device</p>
                  <p className="font-medium">{selectedAssessment.brand} {selectedAssessment.model}</p>
                  <p className="text-sm text-slate-500">{selectedAssessment.storage}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Customer</p>
                  <p className="font-medium">{selectedAssessment.customerName}</p>
                  <p className="text-sm text-slate-500">{selectedAssessment.customerPhone}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">{/^\d{15}$/.test(selectedAssessment.imei) ? "IMEI" : "Serial"}</p>
                  <p className="font-mono">{selectedAssessment.imei}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Condition Score</p>
                  <p className="font-bold text-lg">{selectedAssessment.conditionScore}%</p>
                </div>
              </div>
              
              <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg text-center">
                <p className="text-sm text-green-600 mb-1">Trade-In Value</p>
                <p className="text-3xl font-bold text-green-700">
                  UGX {(selectedAssessment.finalOffer || selectedAssessment.calculatedOffer).toLocaleString()}
                </p>
                <div className="mt-2">
                  {getDecisionBadge(selectedAssessment.decision, selectedAssessment.status)}
                </div>
              </div>

              {selectedAssessment.rejectionReasons && selectedAssessment.rejectionReasons.length > 0 && (
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-medium text-red-800 mb-2">Rejection Reasons:</p>
                  <ul className="list-disc list-inside text-sm text-red-600">
                    {selectedAssessment.rejectionReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fake Device Override Dialog */}
      <Dialog open={showFakeDeviceDialog} onOpenChange={setShowFakeDeviceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Suspicious Device Warning
            </DialogTitle>
            <DialogDescription>
              This device has been flagged for the following issues:
            </DialogDescription>
          </DialogHeader>
          
          {fakeDeviceWarning && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${
                fakeDeviceWarning.severity === "high" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
              }`}>
                <ul className="space-y-2">
                  {fakeDeviceWarning.reasons.map((reason, i) => (
                    <li key={i} className={`text-sm flex items-start gap-2 ${
                      fakeDeviceWarning.severity === "high" ? "text-red-700" : "text-amber-700"
                    }`}>
                      <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="override-reason">Owner Override Reason (Required)</Label>
                <Input
                  id="override-reason"
                  placeholder="Enter reason to proceed despite warnings..."
                  value={ownerOverrideReason}
                  onChange={(e) => setOwnerOverrideReason(e.target.value)}
                  data-testid="input-override-reason"
                />
                <p className="text-xs text-slate-500">
                  This will be logged for audit purposes.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowFakeDeviceDialog(false);
                setOwnerOverrideReason("");
              }}
              data-testid="btn-cancel-override"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleOwnerOverride}
              disabled={!ownerOverrideReason.trim()}
              data-testid="btn-confirm-override"
            >
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

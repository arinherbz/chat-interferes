import { useState, useEffect, useMemo } from "react";
import { useData } from "@/lib/data-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Cpu, Battery, Camera, Volume2, Fingerprint, Package, Lock, CheckCircle,
  Eye, Edit, FileText
} from "lucide-react";
import { BarcodeScanner, ScanResult } from "@/components/barcode-scanner";
import { checkForFakeDevice, type FakeDeviceCheck } from "@/lib/scan-utils";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
}

interface ScoringResult {
  baseValue: number;
  conditionScore: number;
  calculatedOffer: number;
  decision: "auto_accept" | "auto_reject" | "manual_review";
  rejectionReasons: string[];
  deductionBreakdown: { question: string; deduction: number }[];
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
  screen: Smartphone,
  body: Package,
  functionality: Cpu,
  accessories: Package,
};

export default function TradeInPage() {
  const { activeShop, currentUser } = useData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Wizard state
  const [step, setStep] = useState(1);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Form state
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [storage, setStorage] = useState("");
  const [color, setColor] = useState("");
  const [imei, setImei] = useState("");
  const [isIcloudLocked, setIsIcloudLocked] = useState<boolean | null>(null);
  const [isGoogleLocked, setIsGoogleLocked] = useState<boolean | null>(null);
  const [conditionAnswers, setConditionAnswers] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<"Cash" | "MTN" | "Airtel" | "Credit">("Cash");
  
  // Calculated offer state
  const [scoringResult, setScoringResult] = useState<ScoringResult | null>(null);
  
  // UI state
  const [imeiValidation, setImeiValidation] = useState<{ valid: boolean; error?: string; blocked?: boolean; duplicate?: boolean } | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<TradeInAssessment | null>(null);
  
  // Fake device detection state
  const [fakeDeviceWarning, setFakeDeviceWarning] = useState<FakeDeviceCheck | null>(null);
  const [showFakeDeviceDialog, setShowFakeDeviceDialog] = useState(false);
  const [ownerOverrideReason, setOwnerOverrideReason] = useState("");
  const [scanDetectedDevice, setScanDetectedDevice] = useState<{ brand?: string; model?: string } | null>(null);

  // Fetch condition questions
  const { data: questions = [] } = useQuery<ConditionQuestion[]>({
    queryKey: ["/api/trade-in/questions"],
  });

  // Fetch base values
  const { data: baseValues = [] } = useQuery<DeviceBaseValue[]>({
    queryKey: ["/api/trade-in/base-values"],
  });

  // Fetch assessments
  const { data: assessments = [] } = useQuery<TradeInAssessment[]>({
    queryKey: ["/api/trade-in/assessments"],
  });

  // Get unique brands and models from base values
  const brands = useMemo(() => Array.from(new Set(baseValues.map(v => v.brand))).sort(), [baseValues]);
  const models = useMemo(() => 
    Array.from(new Set(baseValues.filter(v => v.brand === brand).map(v => v.model))).sort(), 
    [baseValues, brand]
  );
  const storages = useMemo(() => 
    Array.from(new Set(baseValues.filter(v => v.brand === brand && v.model === model).map(v => v.storage))).sort(),
    [baseValues, brand, model]
  );

  // Get current base value
  const currentBaseValue = useMemo(() => {
    return baseValues.find(v => v.brand === brand && v.model === model && v.storage === storage);
  }, [baseValues, brand, model, storage]);

  // Group questions by category
  const questionsByCategory = useMemo(() => {
    const grouped: Record<string, ConditionQuestion[]> = {};
    questions.forEach(q => {
      if (!grouped[q.category]) grouped[q.category] = [];
      grouped[q.category].push(q);
    });
    return grouped;
  }, [questions]);

  // Validate IMEI mutation
  const validateImeiMutation = useMutation({
    mutationFn: async (imei: string) => {
      const res = await fetch(`/api/trade-in/validate-imei/${imei}`);
      return res.json();
    },
    onSuccess: (data) => {
      setImeiValidation(data);
    },
  });

  // Calculate offer mutation
  const calculateOfferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trade-in/calculate", {
        brand,
        model,
        storage,
        conditionAnswers,
        isIcloudLocked,
        isGoogleLocked,
        imei,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setScoringResult(data);
    },
  });

  // Submit trade-in mutation
  const submitTradeInMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trade-in/submit", {
        brand,
        model,
        storage,
        color,
        imei,
        isIcloudLocked,
        isGoogleLocked,
        conditionAnswers,
        customerName,
        customerPhone,
        customerEmail,
        payoutMethod,
        shopId: activeShop?.id,
        processedBy: currentUser?.id,
        processedByName: currentUser?.name,
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

  // Validate IMEI when it changes
  useEffect(() => {
    if (imei.length === 15) {
      validateImeiMutation.mutate(imei);
    } else {
      setImeiValidation(null);
    }
  }, [imei]);

  // Calculate offer when moving to step 4
  useEffect(() => {
    if (step === 4 && brand && model && storage) {
      calculateOfferMutation.mutate();
    }
  }, [step]);

  const resetForm = () => {
    setStep(1);
    setBrand("");
    setModel("");
    setStorage("");
    setColor("");
    setImei("");
    setIsIcloudLocked(null);
    setIsGoogleLocked(null);
    setConditionAnswers({});
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setPayoutMethod("Cash");
    setScoringResult(null);
    setImeiValidation(null);
    setFakeDeviceWarning(null);
    setScanDetectedDevice(null);
    setOwnerOverrideReason("");
  };

  const handleScanResult = (cleanedValue: string, scanResult?: ScanResult) => {
    setIsScannerOpen(false);
    
    if (scanResult && scanResult.type === "imei") {
      const scannedImei = scanResult.cleanedValue.replace(/\D/g, "").slice(0, 15);
      setImei(scannedImei);
      
      if (scanResult.deviceInfo?.brand) {
        setScanDetectedDevice({
          brand: scanResult.deviceInfo.brand,
          model: scanResult.deviceInfo.model
        });
        
        const detectedBrand = scanResult.deviceInfo.brand;
        if (detectedBrand && brands.includes(detectedBrand)) {
          setBrand(detectedBrand);
          setModel("");
          setStorage("");
          
          if (scanResult.deviceInfo.model) {
            const availableModels = baseValues
              .filter(v => v.brand === detectedBrand)
              .map(v => v.model);
            const matchingModel = availableModels.find(m => 
              m.toLowerCase().includes(scanResult.deviceInfo!.model!.toLowerCase().split(" ").pop() || "")
            );
            if (matchingModel) {
              setModel(matchingModel);
            }
          }
          
          toast({
            title: "Device Detected",
            description: `Auto-filled: ${detectedBrand}${scanResult.deviceInfo.model ? ` ${scanResult.deviceInfo.model}` : ""}`,
            className: "bg-blue-600 text-white border-none",
          });
        }
      }
      
      if (!scanResult.validation.valid) {
        toast({
          title: "Warning",
          description: scanResult.validation.error,
          variant: "destructive",
        });
      }
      
      toast({ title: "IMEI Scanned", description: `IMEI: ${scannedImei}` });
    } else if (scanResult && scanResult.type === "serial") {
      toast({
        title: "Serial Number Scanned",
        description: `This appears to be a serial number, not an IMEI. Please enter the IMEI manually or scan the IMEI barcode.`,
        variant: "destructive",
      });
    } else {
      const scannedImei = cleanedValue.replace(/\D/g, "").slice(0, 15);
      if (scannedImei.length === 15) {
        setImei(scannedImei);
        toast({ title: "Scanned", description: `IMEI: ${scannedImei}` });
      } else {
        toast({
          title: "Unknown Format",
          description: "Could not detect IMEI. Please enter manually.",
          variant: "destructive",
        });
      }
    }
  };

  const checkFakeDevice = () => {
    if (imei && brand && model) {
      const result = checkForFakeDevice(imei, undefined, brand, model);
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

  const canProceedStep1 = brand && model && storage && imei.length === 15 && imeiValidation?.valid;
  const canProceedStep2 = isIcloudLocked !== null && (brand !== "Apple" || isGoogleLocked !== null || isIcloudLocked === false);
  const canProceedStep3 = Object.keys(conditionAnswers).length >= questions.filter(q => q.isRequired).length;
  const canProceedStep4 = scoringResult !== null;
  const canProceedStep5 = customerName && customerPhone;

  const nextStep = () => {
    if (step < 5) setStep(step + 1);
  };

  const handleStep1Next = () => {
    const fakeCheck = checkForFakeDevice(imei, undefined, brand, model);
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
    submitTradeInMutation.mutate();
  };

  const getDecisionBadge = (decision: string, status: string) => {
    if (status === "completed") {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
    }
    switch (decision) {
      case "auto_accept":
      case "accepted":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "auto_reject":
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case "manual_review":
        return <Badge className="bg-amber-100 text-amber-800">Pending Review</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500" data-testid="page-trade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trade-In Center</h1>
          <p className="text-slate-500">Process device buybacks with Apple-style condition assessment.</p>
        </div>
      </div>

      <Tabs defaultValue="new" className="space-y-6">
        <TabsList>
          <TabsTrigger value="new" data-testid="tab-new-tradein">New Trade-In</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">History ({assessments.length})</TabsTrigger>
          <TabsTrigger value="values" data-testid="tab-values">Base Values</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            {WIZARD_STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              
              return (
                <div key={s.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                        isCompleted ? "bg-green-500 text-white" :
                        isActive ? "bg-primary text-white" :
                        "bg-slate-100 text-slate-400"
                      }`}
                      data-testid={`step-indicator-${s.id}`}
                    >
                      {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                    </div>
                    <span className={`mt-2 text-xs font-medium ${isActive ? "text-primary" : "text-slate-500"}`}>
                      {s.title}
                    </span>
                  </div>
                  {i < WIZARD_STEPS.length - 1 && (
                    <div className={`w-16 h-0.5 mx-2 ${step > s.id ? "bg-green-500" : "bg-slate-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Wizard Card */}
            <Card className="lg:col-span-2 border-slate-200 shadow-md">
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Brand</Label>
                        <Select value={brand} onValueChange={(v) => { setBrand(v); setModel(""); setStorage(""); }}>
                          <SelectTrigger data-testid="select-brand">
                            <SelectValue placeholder="Select brand" />
                          </SelectTrigger>
                          <SelectContent>
                            {brands.map(b => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Model</Label>
                        <Select value={model} onValueChange={(v) => { setModel(v); setStorage(""); }} disabled={!brand}>
                          <SelectTrigger data-testid="select-model">
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {models.map(m => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Storage</Label>
                        <Select value={storage} onValueChange={setStorage} disabled={!model}>
                          <SelectTrigger data-testid="select-storage">
                            <SelectValue placeholder="Select storage" />
                          </SelectTrigger>
                          <SelectContent>
                            {storages.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                    
                    <div className="space-y-2">
                      <Label>IMEI Number</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input 
                            placeholder="Enter 15-digit IMEI" 
                            value={imei} 
                            onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
                            className={imeiValidation ? (imeiValidation.valid ? "border-green-500" : "border-red-500") : ""}
                            data-testid="input-imei"
                          />
                          {imeiValidation && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {imeiValidation.valid ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                            </div>
                          )}
                        </div>
                        <Button type="button" variant="outline" size="icon" onClick={() => setIsScannerOpen(true)} data-testid="btn-scan-imei">
                          <Scan className="w-4 h-4" />
                        </Button>
                      </div>
                      {imeiValidation && !imeiValidation.valid && (
                        <p className="text-sm text-red-500 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {imeiValidation.error}
                        </p>
                      )}
                    </div>

                    {currentBaseValue && (
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <p className="text-sm text-blue-800">
                          <strong>Base Value:</strong> UGX {currentBaseValue.baseValue.toLocaleString()}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Final offer depends on condition assessment
                        </p>
                      </div>
                    )}

                    {scanDetectedDevice && (
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200" data-testid="detected-device-autofill">
                        <p className="text-sm text-purple-800">
                          <strong>Scan Detection:</strong> {scanDetectedDevice.brand}
                          {scanDetectedDevice.model && ` ${scanDetectedDevice.model}`}
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          Device info auto-filled from IMEI scan
                        </p>
                      </div>
                    )}

                    {fakeDeviceWarning?.isSuspicious && (
                      <div className={`p-4 rounded-lg border ${
                        fakeDeviceWarning.severity === "high" ? "bg-red-50 border-red-200" :
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

                    <BarcodeScanner 
                      isOpen={isScannerOpen} 
                      onClose={() => setIsScannerOpen(false)} 
                      onScan={handleScanResult}
                      title="Scan IMEI Barcode"
                      enableTTS={true}
                      showValidation={true}
                    />
                  </div>
                )}

                {/* Step 2: Security Checks */}
                {step === 2 && (
                  <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                    <div className="p-6 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5" />
                        <div>
                          <h3 className="font-semibold text-red-800">Critical Security Checks</h3>
                          <p className="text-sm text-red-600 mt-1">
                            Devices with active locks will be automatically rejected.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <Lock className="w-5 h-5 text-slate-600" />
                          <span className="font-medium">Is iCloud / Find My iPhone enabled?</span>
                        </div>
                        <RadioGroup 
                          value={isIcloudLocked === null ? "" : isIcloudLocked ? "yes" : "no"}
                          onValueChange={(v) => setIsIcloudLocked(v === "yes")}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="icloud-no" data-testid="radio-icloud-no" />
                            <Label htmlFor="icloud-no" className="text-green-700 font-medium">No - Signed Out</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="icloud-yes" data-testid="radio-icloud-yes" />
                            <Label htmlFor="icloud-yes" className="text-red-700 font-medium">Yes - Still Active</Label>
                          </div>
                        </RadioGroup>
                        {isIcloudLocked === true && (
                          <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
                            <XCircle className="w-4 h-4" />
                            Device will be automatically rejected
                          </p>
                        )}
                      </div>

                      {brand !== "Apple" && (
                        <div className="p-4 border rounded-lg">
                          <div className="flex items-center gap-3 mb-4">
                            <Lock className="w-5 h-5 text-slate-600" />
                            <span className="font-medium">Is Google FRP (Factory Reset Protection) enabled?</span>
                          </div>
                          <RadioGroup 
                            value={isGoogleLocked === null ? "" : isGoogleLocked ? "yes" : "no"}
                            onValueChange={(v) => setIsGoogleLocked(v === "yes")}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="google-no" data-testid="radio-google-no" />
                              <Label htmlFor="google-no" className="text-green-700 font-medium">No - Account Removed</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="google-yes" data-testid="radio-google-yes" />
                              <Label htmlFor="google-yes" className="text-red-700 font-medium">Yes - Still Linked</Label>
                            </div>
                          </RadioGroup>
                          {isGoogleLocked === true && (
                            <p className="mt-3 text-sm text-red-600 flex items-center gap-1">
                              <XCircle className="w-4 h-4" />
                              Device will be automatically rejected
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Condition Assessment */}
                {step === 3 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <ScrollArea className="h-[400px] pr-4">
                      {Object.entries(questionsByCategory).map(([category, categoryQuestions]) => {
                        const Icon = CATEGORY_ICONS[category] || Cpu;
                        return (
                          <div key={category} className="mb-6">
                            <div className="flex items-center gap-2 mb-4">
                              <Icon className="w-5 h-5 text-primary" />
                              <h3 className="font-semibold capitalize">{category}</h3>
                            </div>
                            <div className="space-y-4 pl-7">
                              {categoryQuestions.map((q) => (
                                <div key={q.id} className="p-4 border rounded-lg bg-slate-50">
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
                                          className={`text-sm ${opt.isRejection ? "text-red-700" : opt.deduction > 20 ? "text-amber-700" : ""}`}
                                        >
                                          {opt.label}
                                          {opt.deduction > 0 && !opt.isRejection && (
                                            <span className="text-xs text-slate-500 ml-2">(-{opt.deduction}%)</span>
                                          )}
                                          {opt.isRejection && (
                                            <span className="text-xs text-red-500 ml-2">(Auto-reject)</span>
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
                    
                    <div className="flex items-center justify-between p-4 bg-slate-100 rounded-lg">
                      <span className="text-sm text-slate-600">
                        Questions answered: {Object.keys(conditionAnswers).length} / {questions.filter(q => q.isRequired).length}
                      </span>
                      <Progress 
                        value={(Object.keys(conditionAnswers).length / Math.max(1, questions.filter(q => q.isRequired).length)) * 100} 
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
                        <div className={`p-6 rounded-lg border-2 ${
                          scoringResult.decision === "auto_accept" ? "bg-green-50 border-green-300" :
                          scoringResult.decision === "auto_reject" ? "bg-red-50 border-red-300" :
                          "bg-amber-50 border-amber-300"
                        }`}>
                          <div className="flex items-center gap-4">
                            {scoringResult.decision === "auto_accept" && <CheckCircle2 className="w-12 h-12 text-green-600" />}
                            {scoringResult.decision === "auto_reject" && <XCircle className="w-12 h-12 text-red-600" />}
                            {scoringResult.decision === "manual_review" && <Clock className="w-12 h-12 text-amber-600" />}
                            <div>
                              <h3 className={`text-xl font-bold ${
                                scoringResult.decision === "auto_accept" ? "text-green-800" :
                                scoringResult.decision === "auto_reject" ? "text-red-800" :
                                "text-amber-800"
                              }`}>
                                {scoringResult.decision === "auto_accept" && "Trade-In Approved!"}
                                {scoringResult.decision === "auto_reject" && "Trade-In Rejected"}
                                {scoringResult.decision === "manual_review" && "Manual Review Required"}
                              </h3>
                              <p className="text-sm mt-1">
                                {scoringResult.decision === "auto_accept" && "Device meets our quality standards."}
                                {scoringResult.decision === "auto_reject" && scoringResult.rejectionReasons.join(", ")}
                                {scoringResult.decision === "manual_review" && "A manager will review this trade-in."}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Offer Amount */}
                        <div className="p-8 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl text-white text-center">
                          <p className="text-sm uppercase tracking-wide text-slate-400 mb-2">Trade-In Value</p>
                          <div className="text-5xl font-bold mb-2">
                            UGX {scoringResult.calculatedOffer.toLocaleString()}
                          </div>
                          <div className="flex items-center justify-center gap-4 text-sm text-slate-400">
                            <span>Base: UGX {scoringResult.baseValue.toLocaleString()}</span>
                            <span>|</span>
                            <span>Score: {scoringResult.conditionScore}%</span>
                          </div>
                        </div>

                        {/* Deduction Breakdown */}
                        {scoringResult.deductionBreakdown.length > 0 && (
                          <div className="p-4 border rounded-lg">
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
                        <div className="p-4 bg-slate-50 rounded-lg">
                          <h4 className="font-medium mb-3">Device Summary</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-slate-500">Brand:</span> {brand}</div>
                            <div><span className="text-slate-500">Model:</span> {model}</div>
                            <div><span className="text-slate-500">Storage:</span> {storage}</div>
                            <div><span className="text-slate-500">IMEI:</span> {imei}</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-slate-500">
                        Unable to calculate offer. Please go back and complete all steps.
                      </div>
                    )}
                  </div>
                )}

                {/* Step 5: Customer Details */}
                {step === 5 && (
                  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
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

                    {/* Final Summary */}
                    <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-4">Trade-In Summary</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500">Device</p>
                          <p className="font-medium">{brand} {model} ({storage})</p>
                        </div>
                        <div>
                          <p className="text-slate-500">IMEI</p>
                          <p className="font-medium">{imei}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Condition Score</p>
                          <p className="font-medium">{scoringResult?.conditionScore}%</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Offer Amount</p>
                          <p className="font-bold text-green-700 text-lg">
                            UGX {scoringResult?.calculatedOffer.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex justify-between border-t pt-6">
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
                ) : (
                  <Button 
                    onClick={handleSubmit}
                    disabled={!canProceedStep5 || submitTradeInMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="btn-submit-tradein"
                  >
                    {submitTradeInMutation.isPending ? "Processing..." : "Complete Trade-In"}
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </CardFooter>
            </Card>

            {/* Sidebar */}
            <div className="space-y-6">
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
              <Card className="bg-slate-900 text-white border-none">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Auto-Rejection Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-300 space-y-2">
                  <p className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    iCloud / Google lock enabled
                  </p>
                  <p className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    Invalid IMEI number
                  </p>
                  <p className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    Duplicate IMEI (already traded)
                  </p>
                  <p className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    Condition score below 30%
                  </p>
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
              <div className="grid grid-cols-2 gap-4">
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
                  <p className="text-sm text-slate-500">IMEI</p>
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

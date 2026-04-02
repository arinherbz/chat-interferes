import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Plus, Pencil, Shield, Laptop, Smartphone, Tablet, Boxes, RotateCcw, Ban } from "lucide-react";
import type { TradeInDeviceType } from "@shared/trade-in-profile";
import { useLocation } from "wouter";

function normalizeStorageInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d+$/.test(trimmed)) return `${trimmed}GB`;
  return trimmed.toUpperCase().replace(/\s+/g, "");
}

function normalizeBrandInput(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

type BaseValue = {
  id?: string;
  brand: string;
  model: string;
  storage: string;
  baseValue: number;
  isActive?: boolean;
  shopId?: string | null;
};

type ConditionOption = {
  value: string;
  label: string;
  deduction: number;
  isRejection?: boolean;
};

type ConditionQuestion = {
  id: string;
  deviceType?: TradeInDeviceType;
  category: string;
  question: string;
  options: ConditionOption[];
  sortOrder: number;
  isRequired: boolean;
  isCritical: boolean;
};

type ConditionProfileResponse = {
  profile?: {
    deviceType: TradeInDeviceType;
    source: "shop" | "default" | "builtin";
    questionCount: number;
    warning?: string;
  };
  questions: ConditionQuestion[];
};

type ConditionQuestionForm = {
  id?: string;
  deviceType: TradeInDeviceType;
  category: string;
  question: string;
  optionsText: string;
  sortOrder: number;
  isRequired: boolean;
  isCritical: boolean;
  isActive: boolean;
};

const DEVICE_TYPE_OPTIONS: { value: TradeInDeviceType; label: string; icon: typeof Smartphone }[] = [
  { value: "phone", label: "Phone", icon: Smartphone },
  { value: "tablet", label: "Tablet", icon: Tablet },
  { value: "laptop", label: "Laptop", icon: Laptop },
  { value: "other", label: "Other", icon: Boxes },
];

export default function BaseValuesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BaseValue[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BaseValue | null>(null);
  const [questionLoading, setQuestionLoading] = useState(true);
  const [conditionQuestions, setConditionQuestions] = useState<ConditionQuestion[]>([]);
  const [conditionProfileMeta, setConditionProfileMeta] = useState<ConditionProfileResponse["profile"] | null>(null);
  const [selectedDeviceType, setSelectedDeviceType] = useState<TradeInDeviceType>("phone");
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionResetting, setQuestionResetting] = useState(false);
  const [form, setForm] = useState<BaseValue>({
    brand: "",
    model: "",
    storage: "",
    baseValue: 0,
    isActive: true,
  });
  const [questionForm, setQuestionForm] = useState<ConditionQuestionForm>({
    deviceType: "phone",
    category: "functionality",
    question: "",
    optionsText: "Working|working|0|false",
    sortOrder: 0,
    isRequired: true,
    isCritical: false,
    isActive: true,
  });
  const [returnToAfterSave, setReturnToAfterSave] = useState<string | null>(null);

  const canEdit = user?.role === "Owner" || user?.role === "Manager";

  const loadConditionProfile = async (deviceType: TradeInDeviceType) => {
    setQuestionLoading(true);
    try {
      const url = `/api/trade-in/questions?deviceType=${deviceType}${user?.shopId ? `&shopId=${encodeURIComponent(user.shopId)}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`Failed to load questions: ${response.status}`);
      }
      const data = (await response.json()) as ConditionQuestion[] | ConditionProfileResponse;
      setConditionQuestions(Array.isArray(data) ? data : data.questions);
      setConditionProfileMeta(Array.isArray(data) ? null : data.profile ?? null);
    } catch (err: any) {
      setConditionQuestions([]);
      setConditionProfileMeta(null);
      toast({ title: "Failed to load condition profile", description: err?.message || "Please retry.", variant: "destructive" });
    } finally {
      setQuestionLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<BaseValue[]>("GET", "/api/trade-in/base-values");
      setRows(data);
    } catch (err: any) {
      toast({ title: "Failed to load base values", description: err?.message || "Please retry.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const brand = params.get("brand");
    const model = params.get("model");
    const storage = params.get("storage");
    const deviceType = params.get("deviceType") as TradeInDeviceType | null;
    const returnTo = params.get("returnTo");

    if (!brand || !model || !storage) {
      setReturnToAfterSave(returnTo);
      return;
    }

    setEditing(null);
    setForm({
      brand: normalizeBrandInput(brand),
      model,
      storage: normalizeStorageInput(storage),
      baseValue: 0,
      isActive: true,
    });
    if (deviceType && DEVICE_TYPE_OPTIONS.some((option) => option.value === deviceType)) {
      setSelectedDeviceType(deviceType);
    }
    setReturnToAfterSave(returnTo);
    setDialogOpen(true);
    setLocation("/base-values", { replace: true });
  }, [setLocation]);

  useEffect(() => {
    loadConditionProfile(selectedDeviceType);
  }, [selectedDeviceType, user?.shopId]);

  const questionsByCategory = useMemo(() => {
    return conditionQuestions.reduce<Record<string, ConditionQuestion[]>>((groups, question) => {
      if (!groups[question.category]) {
        groups[question.category] = [];
      }
      groups[question.category].push(question);
      return groups;
    }, {});
  }, [conditionQuestions]);

  const requiredCount = conditionQuestions.filter((question) => question.isRequired).length;
  const rejectionOptionCount = conditionQuestions.reduce(
    (count, question) => count + question.options.filter((option) => option.isRejection).length,
    0
  );
  const activeDeviceType = DEVICE_TYPE_OPTIONS.find((option) => option.value === selectedDeviceType) ?? DEVICE_TYPE_OPTIONS[0];
  const ActiveDeviceIcon = activeDeviceType.icon;
  const profileSourceLabel =
    conditionProfileMeta?.source === "shop"
      ? "Shop profile"
      : conditionProfileMeta?.source === "default"
        ? "Default profile"
        : conditionProfileMeta?.source === "builtin"
          ? "Built-in fallback"
          : null;

  const openNew = () => {
    setEditing(null);
    setForm({ brand: "", model: "", storage: "", baseValue: 0, isActive: true });
    setDialogOpen(true);
  };

  const openNewQuestion = () => {
    setQuestionForm({
      deviceType: selectedDeviceType,
      category: "functionality",
      question: "",
      optionsText: "Working|working|0|false\nNeeds repair|repair_needed|20|false",
      sortOrder: conditionQuestions.length + 1,
      isRequired: true,
      isCritical: false,
      isActive: true,
    });
    setQuestionDialogOpen(true);
  };

  const openEditQuestion = (question: ConditionQuestion) => {
    setQuestionForm({
      id: question.id,
      deviceType: question.deviceType ?? selectedDeviceType,
      category: question.category,
      question: question.question,
      optionsText: question.options
        .map((option) => `${option.label}|${option.value}|${option.deduction}|${option.isRejection ? "true" : "false"}`)
        .join("\n"),
      sortOrder: question.sortOrder,
      isRequired: question.isRequired,
      isCritical: question.isCritical,
      isActive: true,
    });
    setQuestionDialogOpen(true);
  };

  const openEdit = (row: BaseValue) => {
    setEditing(row);
    setForm({
      brand: row.brand,
      model: row.model,
      storage: row.storage,
      baseValue: row.baseValue,
      isActive: row.isActive ?? true,
      shopId: row.shopId ?? undefined,
    });
    setDialogOpen(true);
  };

  const saveQuestion = async () => {
    const options = questionForm.optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, value, deduction, rejection] = line.split("|").map((part) => part.trim());
        return {
          label,
          value,
          deduction: Number(deduction),
          isRejection: rejection === "true",
        };
      });

    if (!questionForm.question.trim() || !questionForm.category.trim() || options.length < 2) {
      toast({ title: "Invalid question", description: "Question, category, and at least two options are required.", variant: "destructive" });
      return;
    }

    if (options.some((option) => !option.label || !option.value || Number.isNaN(option.deduction))) {
      toast({ title: "Invalid options", description: "Use one option per line: label|value|deduction|true/false", variant: "destructive" });
      return;
    }

    setQuestionSaving(true);
    try {
      await apiRequest("POST", "/api/trade-in/questions/manage", {
        id: questionForm.id,
        deviceType: questionForm.deviceType,
        category: questionForm.category,
        question: questionForm.question,
        options,
        sortOrder: questionForm.sortOrder,
        isRequired: questionForm.isRequired,
        isCritical: questionForm.isCritical,
        isActive: questionForm.isActive,
      });
      toast({ title: questionForm.id ? "Condition question updated" : "Condition question added" });
      setQuestionDialogOpen(false);
      loadConditionProfile(questionForm.deviceType);
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Please retry.", variant: "destructive" });
    } finally {
      setQuestionSaving(false);
    }
  };

  const disableQuestion = async (question: ConditionQuestion) => {
    try {
      await apiRequest("PATCH", `/api/trade-in/questions/${question.id}`, { isActive: false });
      toast({ title: "Condition check disabled" });
      loadConditionProfile(selectedDeviceType);
    } catch (err: any) {
      toast({ title: "Disable failed", description: err?.message || "Please retry.", variant: "destructive" });
    }
  };

  const resetConditionProfile = async () => {
    setQuestionResetting(true);
    try {
      const result = await apiRequest<{ disabledCount: number }>("POST", "/api/trade-in/questions/reset", {
        deviceType: selectedDeviceType,
      });
      toast({
        title: "Profile reset",
        description: result.disabledCount > 0
          ? `${result.disabledCount} custom checks disabled. Standard defaults are active again.`
          : "No custom checks were active. Standard defaults remain in use.",
      });
      loadConditionProfile(selectedDeviceType);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err?.message || "Please retry.", variant: "destructive" });
    } finally {
      setQuestionResetting(false);
    }
  };

  const save = async () => {
    if (!form.brand.trim() || !form.model.trim() || !form.storage.trim()) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (Number.isNaN(form.baseValue) || form.baseValue <= 0) {
      toast({ title: "Enter a valid base value", description: "Must be greater than 0", variant: "destructive" });
      return;
    }
    try {
      await apiRequest("POST", "/api/trade-in/base-values/manage", {
        ...form,
        brand: normalizeBrandInput(form.brand),
        model: form.model.trim().replace(/\s+/g, " "),
        storage: normalizeStorageInput(form.storage),
      });
      toast({ title: editing ? "Base value updated" : "Base value added" });
      setDialogOpen(false);
      setEditing(null);
      await load();
      if (returnToAfterSave === "/trade-in") {
        setLocation("/trade-in?resumeTradeIn=1", { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message || "Please retry.", variant: "destructive" });
    }
  };

  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-2">
        <Badge variant="outline" className="text-red-600 border-red-200">
          Restricted
        </Badge>
        <p className="text-lg font-semibold text-slate-900">Owner or Manager access required.</p>
        <p className="text-slate-500 text-sm">Ask an admin to grant you access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trade-In Base Values</h1>
          <p className="text-slate-500">Manage brand, model, and storage payouts for any device line. Add phones, laptops, tablets, and other brands directly here. Edits apply immediately.</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Base Value
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Device Base Values</CardTitle>
          <CardDescription>Showing {rows.length} entries.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Base Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={`${row.brand}-${row.model}-${row.storage}`}>
                      <TableCell className="font-medium">{row.brand}</TableCell>
                      <TableCell>{row.model}</TableCell>
                      <TableCell>{row.storage}</TableCell>
                      <TableCell className="font-semibold">{row.baseValue.toLocaleString()} UGX</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={row.isActive === false ? "text-red-600 border-red-200" : "text-green-600 border-green-200"}
                        >
                          {row.isActive === false ? "Inactive" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="w-4 h-4 text-slate-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        No base values found. Add one to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Condition Profiles</CardTitle>
          <CardDescription>
            Review the standardized question set the trade-in wizard uses for each device type. The live buyout flow switches between these automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-3">
              <Label>Device Profile</Label>
              <Select value={selectedDeviceType} onValueChange={(value) => setSelectedDeviceType(value as TradeInDeviceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ActiveDeviceIcon className="h-4 w-4" />
                  {activeDeviceType.label} profile
                </div>
                {profileSourceLabel ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{profileSourceLabel}</Badge>
                    {typeof conditionProfileMeta?.questionCount === "number" ? (
                      <Badge variant="outline">{conditionProfileMeta.questionCount} live checks</Badge>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div>{conditionQuestions.length} total checks</div>
                  <div>{requiredCount} required responses</div>
                  <div>{rejectionOptionCount} auto-reject outcomes</div>
                </div>
                <Button className="mt-4 w-full gap-2" onClick={openNewQuestion}>
                  <Plus className="h-4 w-4" />
                  Add Condition Check
                </Button>
                <Button
                  variant="outline"
                  className="mt-2 w-full gap-2"
                  onClick={resetConditionProfile}
                  disabled={questionResetting}
                >
                  {questionResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Reset To Defaults
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              {questionLoading ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading profile...
                </div>
              ) : conditionQuestions.length === 0 ? (
                <p className="text-sm text-slate-500">No questions found for this device type.</p>
              ) : (
                <Accordion type="multiple" defaultValue={Object.keys(questionsByCategory)} className="w-full">
                  {Object.entries(questionsByCategory).map(([category, questions]) => (
                    <AccordionItem key={category} value={category}>
                      <AccordionTrigger className="capitalize">
                        <span className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-slate-500" />
                          {category}
                          <Badge variant="outline" className="ml-2">{questions.length}</Badge>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {questions.map((question) => (
                          <div key={question.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-slate-900">{question.question}</p>
                                {question.isRequired && <Badge variant="outline">Required</Badge>}
                                {question.isCritical && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">Critical</Badge>}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditQuestion(question)}>
                                  <Pencil className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => disableQuestion(question)}>
                                  <Ban className="h-4 w-4 text-rose-500" />
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {question.options.map((option) => (
                                <div key={option.value} className="flex items-center justify-between gap-3 rounded-lg border border-white/70 bg-white px-3 py-2 text-sm">
                                  <span className="text-slate-700">{option.label}</span>
                                  <div className="flex items-center gap-2">
                                    {option.deduction > 0 && (
                                      <Badge variant="outline" className="text-amber-700 border-amber-200">
                                        -{option.deduction}%
                                      </Badge>
                                    )}
                                    {option.isRejection && (
                                      <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
                                        Auto reject
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Base Value" : "Add Base Value"}</DialogTitle>
            <DialogDescription>Save will upsert by brand/model/storage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Brand</Label>
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Apple" />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="iPhone 17 Pro Max" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Storage</Label>
                <Input value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} placeholder="256GB" />
              </div>
              <div className="space-y-2">
                <Label>Base Value (UGX)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  value={form.baseValue || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const parsed = Number(val);
                    setForm({ ...form, baseValue: Number.isNaN(parsed) ? 0 : parsed });
                  }}
                  placeholder="e.g. 4200000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.isActive ? "active" : "inactive"}
                  onValueChange={(val) => setForm({ ...form, isActive: val === "active" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button onClick={() => setDialogOpen(false)} variant="ghost">
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save Changes" : "Add Base Value"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{questionForm.id ? "Edit Condition Check" : "Add Condition Check"}</DialogTitle>
            <DialogDescription>
              Configure the live trade-in rule set for this device profile. Options format: `label|value|deduction|true/false`
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Device Type</Label>
                <Select value={questionForm.deviceType} onValueChange={(value) => setQuestionForm({ ...questionForm, deviceType: value as TradeInDeviceType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={questionForm.category} onChange={(e) => setQuestionForm({ ...questionForm, category: e.target.value })} placeholder="functionality" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Question</Label>
              <Input value={questionForm.question} onChange={(e) => setQuestionForm({ ...questionForm, question: e.target.value })} placeholder="Does the keyboard and trackpad work correctly?" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={questionForm.sortOrder}
                  onChange={(e) => setQuestionForm({ ...questionForm, sortOrder: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Required</Label>
                <Select value={questionForm.isRequired ? "yes" : "no"} onValueChange={(value) => setQuestionForm({ ...questionForm, isRequired: value === "yes" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Critical</Label>
                <Select value={questionForm.isCritical ? "yes" : "no"} onValueChange={(value) => setQuestionForm({ ...questionForm, isCritical: value === "yes" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Options</Label>
              <Textarea
                rows={8}
                value={questionForm.optionsText}
                onChange={(e) => setQuestionForm({ ...questionForm, optionsText: e.target.value })}
                placeholder={"Working|working|0|false\nNeeds repair|repair_needed|20|false\nBlocked device|blocked|100|true"}
              />
              <p className="text-xs text-slate-500">
                One option per line. `deduction` is a percentage. Use `true` on the last field for auto-reject answers.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveQuestion} disabled={questionSaving}>
              {questionSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save condition check
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

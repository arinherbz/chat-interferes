import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format, isBefore } from "date-fns";
import { useData, type Lead } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";

type LeadStatus = "new" | "contacted" | "in_progress" | "won" | "lost";
type LeadPriority = "low" | "normal" | "high";

export default function LeadsPage() {
  const { leads, addLead, updateLead, addLeadFollowUp, users, currentUser } = useData();
  const { user } = useAuth();
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    source: "Walk-in",
    priority: "normal" as LeadPriority,
    notes: "",
    assignedTo: user?.id || "",
    nextFollowUpAt: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState({ leadId: "", note: "", result: "", nextAt: "" });
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  const [filterPriority, setFilterPriority] = useState<LeadPriority | "all">("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [reminders, setReminders] = useState<{ leadId: string; due: string; name: string }[]>([]);

  // Filter: staff sees their own; owner/manager see all
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const statusOk = filterStatus === "all" || l.status === filterStatus;
      const priorityOk = filterPriority === "all" || l.priority === filterPriority;
      const ownerOk = filterOwner === "all" || l.createdBy === filterOwner;
      const assignedOk = filterAssignee === "all" || l.assignedTo === filterAssignee;
      const roleGate = user?.role === "Owner" || user?.role === "Manager" ? true : l.assignedTo === user?.id || l.createdBy === user?.id;
      const searchOk = search
        ? l.customerName.toLowerCase().includes(search.toLowerCase()) ||
          l.customerPhone.toLowerCase().includes(search.toLowerCase())
        : true;
      return statusOk && priorityOk && ownerOk && assignedOk && roleGate && searchOk;
    });
  }, [leads, filterStatus, filterPriority, filterOwner, filterAssignee, search, user?.role, user?.id]);

  const addOrUpdateLead = () => {
    if (!form.customerName || !form.customerPhone) return;
    if (editingId) {
      updateLead(editingId, {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        source: form.source || undefined,
        notes: form.notes || undefined,
        assignedTo: form.assignedTo || undefined,
        priority: form.priority,
        nextFollowUpAt: form.nextFollowUpAt || undefined,
      });
    } else {
      addLead({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        source: form.source || undefined,
        notes: form.notes || undefined,
        assignedTo: form.assignedTo || undefined,
        priority: form.priority,
        status: "new",
        nextFollowUpAt: form.nextFollowUpAt || undefined,
        shopId: undefined,
      });
    }
    setForm({ customerName: "", customerPhone: "", customerEmail: "", source: "Walk-in", priority: "normal", notes: "", assignedTo: user?.id || "", nextFollowUpAt: "" });
    setEditingId(null);
  };

  const addFollowUpEntry = () => {
    if (!followUp.leadId || !followUp.note) return;
    addLeadFollowUp(followUp.leadId, {
      by: user?.name || "You",
      byId: user?.id,
      note: followUp.note,
      result: followUp.result || undefined,
      at: new Date().toISOString(),
    });
    if (followUp.nextAt) {
      updateLead(followUp.leadId, { nextFollowUpAt: followUp.nextAt });
    }
    setFollowUp({ leadId: "", note: "", result: "", nextAt: "" });
  };

  const statusBadge = (status: LeadStatus) => {
    const map: Record<LeadStatus, string> = {
      new: "bg-blue-50 text-blue-700",
      contacted: "bg-amber-50 text-amber-700",
      in_progress: "bg-indigo-50 text-indigo-700",
      won: "bg-green-50 text-green-700",
      lost: "bg-red-50 text-red-700",
    };
    return <Badge className={map[status]}>{status.replace("_", " ")}</Badge>;
  };

  useEffect(() => {
    const due = leads
      .filter(l => l.assignedTo === user?.id && l.nextFollowUpAt)
      .map(l => ({ leadId: l.id, due: l.nextFollowUpAt!, name: l.customerName }))
      .filter(r => isBefore(new Date(r.due), new Date()));
    setReminders(due);
  }, [leads, user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads & Follow-ups</h1>
          <p className="text-slate-500">Assign to staff, set reminders, and track follow-ups.</p>
        </div>
        <div className="text-sm text-slate-600">
          {reminders.length > 0 ? (
            <Badge className="bg-amber-100 text-amber-800">Reminders due: {reminders.length}</Badge>
          ) : (
            <Badge variant="outline">No due reminders</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Leads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input placeholder="Search name/phone" value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[200px]" />
              <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={(v: any) => setFilterPriority(v)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterOwner} onValueChange={(v: any) => setFilterOwner(v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Created by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterAssignee} onValueChange={(v: any) => setFilterAssignee(v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Assigned to" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {filteredLeads.map((lead) => (
                <div key={lead.id} className="p-4 border rounded-lg bg-white shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{lead.customerName}</span>
                        {statusBadge(lead.status)}
                        <Badge variant="outline">{lead.priority.toUpperCase()}</Badge>
                      </div>
                      <p className="text-sm text-slate-500">{lead.customerPhone} {lead.customerEmail && `• ${lead.customerEmail}`}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Source: {lead.source || "N/A"} • Created {format(new Date(lead.createdAt), "MMM dd, yyyy")}
                        {lead.createdByName ? ` by ${lead.createdByName}` : ""}
                        {lead.assignedToName ? ` • Assigned to ${lead.assignedToName}` : ""}
                      </p>
                    </div>
                    <div className="text-sm text-slate-500">
                      Next follow-up: {lead.nextFollowUpAt ? format(new Date(lead.nextFollowUpAt), "PPp") : "Not set"}
                    </div>
                  </div>
                  {lead.notes && <p className="text-sm text-slate-600 mt-2">Notes: {lead.notes}</p>}
                  {lead.followUpHistory.length > 0 && (
                    <div className="mt-3 text-sm text-slate-600">
                      <p className="font-medium mb-1">Follow-ups:</p>
                      <ul className="space-y-1">
                        {lead.followUpHistory.map((f, idx) => (
                          <li key={idx} className="text-xs text-slate-500">
                            {format(new Date(f.at), "PPp")} — {f.by}: {f.note} {f.result && `(${f.result})`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(user?.role === "Owner" || user?.role === "Manager" || lead.assignedTo === user?.id) && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingId(lead.id);
                          setForm({
                            customerName: lead.customerName,
                            customerPhone: lead.customerPhone,
                            customerEmail: lead.customerEmail || "",
                            source: lead.source || "Walk-in",
                            priority: lead.priority,
                            notes: lead.notes || "",
                            assignedTo: lead.assignedTo || user?.id || "",
                            nextFollowUpAt: lead.nextFollowUpAt || "",
                          });
                        }}
                      >
                        Edit
                      </Button>
                      {(user?.role === "Owner" || user?.role === "Manager") && lead.status !== "won" && lead.status !== "lost" && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => updateLead(lead.id, { status: "won", nextFollowUpAt: undefined })}
                          >
                            Mark Won
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => updateLead(lead.id, { status: "lost", nextFollowUpAt: undefined })}
                          >
                            Mark Lost
                          </Button>
                        </>
                      )}
                      {(user?.role === "Owner" || user?.role === "Manager") && (lead.status === "won" || lead.status === "lost") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateLead(lead.id, { status: "in_progress" })}
                        >
                          Reopen
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {filteredLeads.length === 0 && <p className="text-sm text-slate-500">No leads match the filter.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>{editingId ? "Edit Lead" : "New Lead"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="Full name" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="07..." />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} placeholder="email@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Walk-in, referral..." />
              </div>
              <div className="space-y-2">
                <Label>Assign to</Label>
                <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v: any) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next Follow-up (reminder)</Label>
                <Input type="datetime-local" value={form.nextFollowUpAt} onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button onClick={addOrUpdateLead} className="w-full">Save Lead</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Add Follow-up</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Lead</Label>
                <Select value={followUp.leadId} onValueChange={(v) => setFollowUp({ ...followUp, leadId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.customerName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea value={followUp.note} onChange={(e) => setFollowUp({ ...followUp, note: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Result</Label>
                <Select value={followUp.result} onValueChange={(v) => setFollowUp({ ...followUp, result: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional result" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="won">Won</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                    <SelectItem value="continue">Continue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next follow-up date</Label>
                <Input type="datetime-local" value={followUp.nextAt} onChange={(e) => setFollowUp({ ...followUp, nextAt: e.target.value })} />
              </div>
              <Button onClick={addFollowUpEntry} className="w-full" variant="secondary">Save Follow-up</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, ArrowRight, KeyRound, Copy, Check, Loader2 } from "lucide-react";
import { linkPatient } from "../api/patientsApi";
import { useDashboardStore } from "../store/dashboardStore";

const STATUS_PILL = {
  info: "bg-lime-100 text-lime-700",
  warning: "bg-orange-100 text-orange-700",
  critical: "bg-rose-100 text-rose-700",
};

const STATUS_LABEL = {
  info: "Stable",
  warning: "Warning",
  critical: "Critical",
};

function LinkPatientCard() {
  const patients = useDashboardStore((s) => s.patients);
  const setPatients = useDashboardStore((s) => s.setPatients);

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      // Redeems the code and adds the patient to this caregiver's roster —
      // see POST /api/v1/patients/link in backend/app/main.py.
      const patient = await linkPatient(code.trim());
      const alreadyThere = patients.some((p) => p.id === patient.id);
      setPatients(alreadyThere ? patients.map((p) => (p.id === patient.id ? patient : p)) : [...patients, patient]);
      setSuccess(`Linked ${patient.full_name} to your roster.`);
      setCode("");
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "Couldn't redeem that code. Check it and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-surface rounded-[28px] shadow-sm p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-xl bg-lime-100 flex items-center justify-center">
          <KeyRound className="w-4 h-4 text-lime-700" />
        </span>
        <p className="text-sm font-semibold text-gray-900">Link a patient</p>
      </div>
      <p className="text-xs text-gray-400 mb-4 ml-10">
        Enter the invite code the patient or their family shared with you.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 ml-10">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. 7K3QXPRT"
          maxLength={12}
          className="bg-gray-100 rounded-2xl px-4 py-2.5 text-sm font-mono tracking-wide text-gray-900 placeholder:text-gray-400 outline-none w-48"
        />
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-semibold px-4 py-2.5 rounded-2xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {submitting ? "Linking..." : "Link patient"}
        </button>
      </form>

      {error && <p className="text-xs text-rose-600 font-medium mt-2 ml-10">{error}</p>}
      {success && <p className="text-xs text-lime-700 font-medium mt-2 ml-10">{success}</p>}
    </div>
  );
}

function InviteCodeCell({ code }) {
  const [copied, setCopied] = useState(false);

  if (!code) return <span className="text-gray-300">—</span>;

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy invite code to share with another caregiver"
      className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-2.5 py-1 rounded-full transition-colors"
    >
      {code}
      {copied ? <Check className="w-3 h-3 text-lime-600" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const patients = useDashboardStore((s) => s.patients);
  const patientsLoading = useDashboardStore((s) => s.patientsLoading);
  const patientsError = useDashboardStore((s) => s.patientsError);
  const selectedPatientId = useDashboardStore((s) => s.selectedPatientId);
  const setSelectedPatientId = useDashboardStore((s) => s.setSelectedPatientId);

  const openInDashboard = (id) => {
    setSelectedPatientId(id);
    navigate("/dashboard");
  };

  return (
    <div className="space-y-5">
      <LinkPatientCard />

      <section className="bg-surface rounded-[28px] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-600" />
            </span>
            <p className="text-sm font-semibold text-gray-900">Your Patients</p>
          </div>
          <span className="text-xs text-gray-400">{patients.length} linked</span>
        </div>

        {patientsLoading ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">Loading patients...</p>
        ) : patientsError ? (
          <p className="px-6 py-10 text-center text-sm text-rose-500">Couldn't load patients: {patientsError}</p>
        ) : patients.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            No patients linked yet — enter an invite code above to add your first patient.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-gray-400 uppercase tracking-wide border-y border-gray-100">
                  <th className="px-6 py-2.5 font-semibold">Patient</th>
                  <th className="px-6 py-2.5 font-semibold">Room</th>
                  <th className="px-6 py-2.5 font-semibold">Status</th>
                  <th className="px-6 py-2.5 font-semibold">Invite code</th>
                  <th className="px-6 py-2.5 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[11px] font-bold text-gray-600 shrink-0">
                          {p.initials}
                        </span>
                        <span className="font-medium text-gray-900">{p.full_name}</span>
                        {p.id === selectedPatientId && (
                          <span className="text-[10px] font-semibold text-lime-700 bg-lime-100 px-1.5 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-gray-500">{p.room || "—"}</td>
                    <td className="px-6 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_PILL[p.latest_status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[p.latest_status] || p.latest_status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <InviteCodeCell code={p.invite_code} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        onClick={() => openInDashboard(p.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800"
                      >
                        View vitals <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

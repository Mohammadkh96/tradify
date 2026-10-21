import React, { useState, useEffect } from 'react';
import {
  Scale,
  ShieldAlert,
  CheckCircle,
  XCircle,
  FileText,
  AlertTriangle,
  Globe,
} from 'lucide-react';
import { JurisdictionPolicy } from '../types/index.js';

export const CompliancePanel: React.FC = () => {
  const [policies, setPolicies] = useState<JurisdictionPolicy[]>([]);

  useEffect(() => {
    fetch('/api/compliance/policies')
      .then((res) => res.json())
      .then((data) => {
        if (data.policies) setPolicies(data.policies);
      })
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-3 shadow-xl">
        <div className="flex items-center space-x-2.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
          <Scale className="w-4 h-4" />
          <span>Regulatory Architecture & Compliance Matrix</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white">Jurisdiction Policies & Guardrails</h1>
        <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
          Tradigo enforces strict non-discretionary peer coaching boundaries. We are not a broker,
          copy-trading platform, signal provider, or asset manager.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {policies.map((pol) => (
          <div
            key={pol.countryCode}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm text-white">{pol.regionName}</h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                {pol.countryCode}
              </span>
            </div>

            {/* Allowed Activities */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Permitted Educational Scope:</span>
              </div>
              <div className="space-y-1 text-xs text-slate-300">
                {pol.allowedActivities.map((act) => (
                  <div key={act} className="bg-slate-950/70 p-1.5 rounded border border-slate-800/80">
                    {act.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>

            {/* Prohibited Activities */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>Strictly Prohibited:</span>
              </div>
              <div className="space-y-1 text-xs text-slate-400">
                {pol.prohibitedActivities.map((act) => (
                  <div key={act} className="bg-rose-950/20 p-1.5 rounded border border-rose-900/30 text-rose-300">
                    {act.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>

            {/* Mandatory Disclaimer */}
            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed italic">
              "{pol.mandatoryEducationalDisclaimer}"
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

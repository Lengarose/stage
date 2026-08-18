import { useState } from "react";
import { Coins, Plus, Target, Trash2 } from "lucide-react";
import { getStatOptionsForPosition, groupStatOptions } from "@/lib/contractPerformanceTargets";
import {
  FOUNDER_PLAYER_WEEKLY_SALARY_MAX,
  FOUNDER_PLAYER_WEEKLY_SALARY_MIN,
  founderPlayerWageError,
  isFounderPlayerWageAllowed,
  normalizeFounderPlayerTerms,
} from "@/lib/founderPlayerTerms";
import { formatSTC } from "@/lib/playerValue";
import { useTranslation } from "@/hooks/useTranslation";

const inputCls = "w-full bg-white/10 border border-white/20 text-white placeholder-white/35 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/55 focus:bg-white/15 transition-all";
const labelCls = "text-[10px] text-white/45 uppercase tracking-widest mb-1 block";

export default function FounderPlayerTermsSetup({ player, initialTerms = null, onComplete }) {
  const { t } = useTranslation();
  const seeded = normalizeFounderPlayerTerms(initialTerms || {});
  const [weeklySalary, setWeeklySalary] = useState(seeded.weekly_salary_stc ? String(seeded.weekly_salary_stc) : "");
  const [signingBonus, setSigningBonus] = useState(seeded.signing_bonus_stc ? String(seeded.signing_bonus_stc) : "");
  const [targets, setTargets] = useState(seeded.performance_targets);
  const statOptions = getStatOptionsForPosition(player?.position);
  const groupedStats = groupStatOptions(statOptions);

  const TARGET_TYPES = [
    { value: "min", label: t("commonPages.cccTargetMin") },
    { value: "exact", label: t("commonPages.cccTargetExact") },
    { value: "range", label: t("commonPages.cccTargetRange") },
  ];

  function addTarget() {
    setTargets((prev) => [...prev, { stat: statOptions[0]?.value || "goals", type: "min", value: 0, value_max: 0 }]);
  }

  function updateTarget(idx, field, val) {
    setTargets((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));
  }

  function removeTarget(idx) {
    setTargets((prev) => prev.filter((_, i) => i !== idx));
  }

  const wageError = founderPlayerWageError(weeklySalary);

  function handleContinue() {
    if (!isFounderPlayerWageAllowed(weeklySalary)) return;
    onComplete?.(normalizeFounderPlayerTerms({
      weekly_salary_stc: weeklySalary,
      signing_bonus_stc: signingBonus,
      performance_targets: targets,
    }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white mb-1">
          {t("commonPages.obFounderWagesTitle")}
        </h2>
        <p className="text-white/40 text-xs leading-relaxed">
          {t("commonPages.obFounderWagesDesc")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>
            <span className="inline-flex items-center gap-1">
              <Coins className="w-3 h-3 text-emerald-300" /> {t("commonPages.cccWeeklySalary")}
            </span>
          </label>
          <input
            type="number"
            min={FOUNDER_PLAYER_WEEKLY_SALARY_MIN}
            max={FOUNDER_PLAYER_WEEKLY_SALARY_MAX}
            value={weeklySalary}
            onChange={(e) => setWeeklySalary(e.target.value)}
            placeholder="e.g. 0"
            className={inputCls}
          />
          <p className="text-[10px] text-white/40 mt-1">
            {t("commonPages.founderWageRange", {
              max: formatSTC(FOUNDER_PLAYER_WEEKLY_SALARY_MAX),
            })}
          </p>
        </div>
        <div>
          <label className={labelCls}>
            <span className="inline-flex items-center gap-1">
              <Coins className="w-3 h-3 text-amber-300" /> {t("commonPages.cccSigningBonus")}
            </span>
          </label>
          <input
            type="number"
            min="0"
            value={signingBonus}
            onChange={(e) => setSigningBonus(e.target.value)}
            placeholder="e.g. 5000"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-white/45 uppercase tracking-widest flex items-center gap-1">
            <Target className="w-3 h-3" /> {t("commonPages.ocdPerformanceTargets")}
          </p>
          {targets.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 font-bold">
              {targets.length}
            </span>
          )}
        </div>

        {targets.map((target, idx) => (
          <div key={`${target.stat}-${idx}`} className="rounded-xl border border-white/15 bg-white/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={target.stat}
                onChange={(e) => updateTarget(idx, "stat", e.target.value)}
                className="flex-1 bg-[#09111f] border border-white/15 text-white text-xs rounded-lg px-2 py-2"
              >
                {Object.entries(groupedStats).map(([category, options]) => (
                  <optgroup key={category} label={category}>
                    {options.map((stat) => (
                      <option key={stat.value} value={stat.value}>{stat.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <select
                value={target.type}
                onChange={(e) => updateTarget(idx, "type", e.target.value)}
                className="flex-1 bg-[#09111f] border border-white/15 text-white text-xs rounded-lg px-2 py-2"
              >
                {TARGET_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => removeTarget(idx)} className="text-red-300 hover:text-red-200 p-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={target.value}
                onChange={(e) => updateTarget(idx, "value", parseFloat(e.target.value) || 0)}
                placeholder={target.type === "range" ? t("commonPages.cccMin") : t("commonPages.cccValue")}
                className={inputCls}
              />
              {target.type === "range" && (
                <>
                  <span className="text-white/35 text-xs">–</span>
                  <input
                    type="number"
                    value={target.value_max || ""}
                    onChange={(e) => updateTarget(idx, "value_max", parseFloat(e.target.value) || 0)}
                    placeholder={t("commonPages.cccMax")}
                    className={inputCls}
                  />
                </>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addTarget}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-dashed border-white/20 text-white/70 text-xs hover:bg-white/5 transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> {t("commonPages.cccAddTarget")}
        </button>
      </div>

      {wageError ? (
        <p className="text-xs text-red-300">{t("commonPages.founderWageRequired", {
          max: formatSTC(FOUNDER_PLAYER_WEEKLY_SALARY_MAX),
        })}</p>
      ) : null}

      <button
        type="button"
        onClick={handleContinue}
        disabled={Boolean(wageError)}
        className="w-full bg-white text-[#0d2461] font-black uppercase tracking-widest py-3 rounded-xl text-sm hover:bg-gray-100 transition-all shadow-lg disabled:opacity-40 disabled:pointer-events-none"
      >
        {t("commonPages.obContinueClub")}
      </button>
    </div>
  );
}

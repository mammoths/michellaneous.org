"use client"

import { useState } from "react"
import type { Goal, StampTemplate, WeeklyBudget } from "@/lib/planner"
import { newSlotId } from "@/lib/planner"

type Props = {
  goals: Goal[]
  stamps: StampTemplate[]
  budgets: Record<string, WeeklyBudget>
  onGoalsChange: (goals: Goal[]) => void
  width: number
}

const INK   = "#2C1A0E"
const SAGE  = "#7A8C6E"
const PARCH = "#F5ECD7"
const TERRA = "#C0392B"

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now    = new Date()
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000))
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase()
}

function suggestedWeekly(goal: Goal): string {
  const budget = goal.period === "weekly" ? goal.period_target : Math.ceil(goal.period_target / 52)
  return `${budget} ${goal.period_unit} this week →`
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, stamps, budget, onSave, onDelete, panelWidth }: {
  goal: Goal
  stamps: StampTemplate[]
  budget?: WeeklyBudget
  onSave: (updated: Goal) => void
  onDelete: () => void
  panelWidth: number
}) {
  const [editing, setEditing] = useState(false)
  const [desc, setDesc]       = useState(goal.description)
  const [date, setDate]       = useState(goal.target_date)
  const [target, setTarget]   = useState(String(goal.period_target))
  const [unit, setUnit]       = useState(goal.period_unit)
  const [period, setPeriod]   = useState(goal.period)
  const [stampId, setStampId] = useState(goal.stamp_id)

  // Slight random tilt per card — stable
  const [tilt] = useState(() => (Math.random() * 4 - 2).toFixed(1) + "deg")

  // Scale fonts with panel width: 200px→base, 400px→1.6×
  const scale   = Math.max(1, Math.min(1.8, panelWidth / 200))
  const descFs  = Math.round(12.5 * scale)
  const metaFs  = Math.round(10   * scale)
  const statFs  = Math.round(7.5  * scale)
  const labelFs = Math.round(7    * scale)
  const editFs  = Math.round(9    * scale)
  const pad     = Math.round(9    * scale)

  function handleSave() {
    const n = parseFloat(target)
    if (!desc.trim() || isNaN(n) || n <= 0) return
    onSave({ ...goal, description: desc.trim(), target_date: date, period, period_target: n, period_unit: unit, stamp_id: stampId })
    setEditing(false)
  }

  const days  = daysUntil(goal.target_date)
  const stamp = stamps.find(s => s.id === goal.stamp_id)

  if (editing) {
    return (
      <div style={{
        background: PARCH,
        border: "1px solid rgba(44,26,14,0.15)",
        borderRadius: 2, padding: `${pad}px ${pad + 2}px`,
        marginBottom: 8,
        display: "flex", flexDirection: "column", gap: Math.round(5 * scale),
        fontFamily: "var(--font-hand)", fontSize: descFs,
      }}>
        <input
          autoFocus value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); e.stopPropagation() }}
          placeholder="description"
          style={{ fontFamily: "var(--font-hand)", fontSize: descFs, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.25)", outline: "none", padding: "1px 0" }}
        />
        <input
          type="date" value={date}
          onChange={e => setDate(e.target.value)}
          onKeyDown={e => e.stopPropagation()}
          style={{ fontFamily: "var(--font-type)", fontSize: editFs, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.15)", outline: "none" }}
        />
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <input
            value={target}
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); e.stopPropagation() }}
            style={{ width: Math.round(40 * scale), fontFamily: "var(--font-type)", fontSize: editFs, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.15)", outline: "none", textAlign: "center" }}
          />
          <input
            value={unit}
            onChange={e => setUnit(e.target.value)}
            placeholder="unit"
            onKeyDown={e => e.stopPropagation()}
            style={{ flex: 1, fontFamily: "var(--font-type)", fontSize: editFs, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.15)", outline: "none" }}
          />
          <select value={period} onChange={e => setPeriod(e.target.value as Goal["period"])}
            style={{ fontFamily: "var(--font-type)", fontSize: editFs, color: INK, background: "transparent", border: "none", outline: "none" }}>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
          </select>
        </div>
        <select value={stampId} onChange={e => setStampId(e.target.value)}
          style={{ fontFamily: "var(--font-type)", fontSize: editFs, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.1)", outline: "none" }}>
          {stamps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
          <button onClick={handleSave} style={{ fontSize: editFs, color: SAGE, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-type)" }}>save</button>
          <button onClick={() => setEditing(false)} style={{ fontSize: editFs, color: INK, opacity: 0.35, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-type)" }}>cancel</button>
          <button onClick={onDelete} style={{ fontSize: editFs, color: TERRA, opacity: 0.5, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-type)", marginLeft: "auto" }}>remove</button>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        background: PARCH,
        border: "1px solid rgba(44,26,14,0.12)",
        borderRadius: 2,
        padding: `${pad}px ${pad + 2}px`,
        marginBottom: 8,
        transform: `rotate(${tilt})`,
        cursor: "pointer",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        boxShadow: "1px 2px 4px rgba(0,0,0,0.08)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "rotate(0deg)"
        e.currentTarget.style.boxShadow = "2px 4px 8px rgba(0,0,0,0.13)"
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = `rotate(${tilt})`
        e.currentTarget.style.boxShadow = "1px 2px 4px rgba(0,0,0,0.08)"
      }}
    >
      <div style={{ fontFamily: "var(--font-hand)", fontSize: descFs, color: INK, lineHeight: 1.35, marginBottom: Math.round(4 * scale) }}>
        <span style={{ color: SAGE, marginRight: 5 }}>✦</span>
        {goal.description}
      </div>

      <div style={{ fontFamily: "var(--font-hand)", fontSize: metaFs, color: INK, opacity: 0.55, lineHeight: 1.4 }}>
        {fmtDate(goal.target_date)}
        {days <= 180 && <span style={{ marginLeft: 5 }}>· {days}d left</span>}
        {" · "}
        {suggestedWeekly(goal)}
      </div>

      {budget && (
        <div style={{ marginTop: Math.round(4 * scale), fontFamily: "var(--font-type)", fontSize: statFs, color: TERRA }}>
          {budget.allocated}/{budget.total} {goal.period_unit} allocated
          {budget.remaining > 0 && <span style={{ color: INK, opacity: 0.4 }}> · {budget.remaining} left</span>}
        </div>
      )}

      {stamp && (
        <div style={{ marginTop: Math.round(3 * scale), fontFamily: "var(--font-type)", fontSize: labelFs, color: INK, opacity: 0.3, letterSpacing: "1px" }}>
          ↳ {stamp.name}
        </div>
      )}
    </div>
  )
}

// ─── NorthStar ────────────────────────────────────────────────────────────────

export default function NorthStar({ goals, stamps, budgets, onGoalsChange, width }: Props) {
  const [adding, setAdding] = useState(false)
  const [newDesc, setNewDesc]     = useState("")
  const [newDate, setNewDate]     = useState("")
  const [newTarget, setNewTarget] = useState("")
  const [newUnit, setNewUnit]     = useState("")
  const [newPeriod, setNewPeriod] = useState<Goal["period"]>("weekly")
  const [newStampId, setNewStampId] = useState("")

  function handleAdd() {
    const n = parseFloat(newTarget)
    if (!newDesc.trim() || !newDate || isNaN(n) || n <= 0) return
    const goal: Goal = {
      id: "goal-" + newSlotId(),
      stamp_id: newStampId || (stamps[0]?.id ?? ""),
      description: newDesc.trim(),
      target_date: newDate,
      period: newPeriod,
      period_target: n,
      period_unit: newUnit.trim() || "units",
    }
    onGoalsChange([...goals, goal])
    setNewDesc(""); setNewDate(""); setNewTarget(""); setNewUnit(""); setAdding(false)
  }

  function handleSave(idx: number, updated: Goal) {
    const next = [...goals]
    next[idx] = updated
    onGoalsChange(next)
  }

  function handleDelete(idx: number) {
    onGoalsChange(goals.filter((_, i) => i !== idx))
  }

  return (
    <div style={{
      width: "100%",
      flex: 1,
      borderLeft: "1px solid rgba(44,26,14,0.1)",
      overflowY: "auto", overflowX: "hidden",
      padding: "12px 12px 16px",
      scrollbarWidth: "none",
    }}>
      {/* Header */}
      <div style={{
        fontFamily: "var(--font-type)", fontSize: 9,
        letterSpacing: "2.5px", color: SAGE,
        marginBottom: 12, textTransform: "uppercase",
      }}>
        ✦ north star
      </div>

      {/* Goal cards */}
      {goals.map((goal, i) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          stamps={stamps}
          budget={budgets[goal.id]}
          onSave={updated => handleSave(i, updated)}
          onDelete={() => handleDelete(i)}
          panelWidth={width}
        />
      ))}

      {/* Add goal */}
      {adding ? (
        <div style={{
          background: PARCH,
          border: "1px dashed rgba(44,26,14,0.2)",
          borderRadius: 2, padding: "10px 11px",
          display: "flex", flexDirection: "column", gap: 6,
          fontFamily: "var(--font-hand)", fontSize: 13,
        }}>
          <input
            autoFocus value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") setAdding(false); e.stopPropagation() }}
            placeholder="what's the goal?"
            style={{ fontFamily: "var(--font-hand)", fontSize: 13, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.25)", outline: "none", padding: "1px 0" }}
          />
          <input
            type="date" value={newDate}
            onChange={e => setNewDate(e.target.value)}
            onKeyDown={e => e.stopPropagation()}
            style={{ fontFamily: "var(--font-type)", fontSize: 9, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.15)", outline: "none" }}
          />
          <div style={{ display: "flex", gap: 5 }}>
            <input
              value={newTarget} onChange={e => setNewTarget(e.target.value)}
              placeholder="target"
              onKeyDown={e => e.stopPropagation()}
              style={{ width: 44, fontFamily: "var(--font-type)", fontSize: 9, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.15)", outline: "none", textAlign: "center" }}
            />
            <input
              value={newUnit} onChange={e => setNewUnit(e.target.value)}
              placeholder="unit"
              onKeyDown={e => e.stopPropagation()}
              style={{ flex: 1, fontFamily: "var(--font-type)", fontSize: 9, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.15)", outline: "none" }}
            />
            <select value={newPeriod} onChange={e => setNewPeriod(e.target.value as Goal["period"])}
              style={{ fontFamily: "var(--font-type)", fontSize: 8, color: INK, background: "transparent", border: "none", outline: "none" }}>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
            </select>
          </div>
          <select value={newStampId} onChange={e => setNewStampId(e.target.value)}
            style={{ fontFamily: "var(--font-type)", fontSize: 8, color: INK, background: "transparent", border: "none", borderBottom: "0.8px solid rgba(44,26,14,0.1)", outline: "none" }}>
            <option value="">link to stamp…</option>
            {stamps.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleAdd} style={{ fontSize: 9, color: SAGE, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-type)" }}>add</button>
            <button onClick={() => setAdding(false)} style={{ fontSize: 9, color: INK, opacity: 0.35, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-type)" }}>cancel</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            fontFamily: "var(--font-hand)", fontSize: 13,
            color: SAGE, opacity: 0.65,
            background: "none", border: "none",
            cursor: "pointer", padding: "4px 0",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          add north star
        </button>
      )}
    </div>
  )
}

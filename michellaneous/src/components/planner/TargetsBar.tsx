"use client"

import type { Goal, StampTemplate, WeeklyBudget } from "@/lib/planner"

type Props = {
  goals: Goal[]
  budgets: Record<string, WeeklyBudget>
  stamps: StampTemplate[]
}

const INK  = "#2C1A0E"
const SAGE = "#7A8C6E"
const TERRA = "#C0392B"

export default function TargetsBar({ goals, budgets, stamps }: Props) {
  const items = goals.map(goal => {
    const budget = budgets[goal.id]
    const stamp  = stamps.find(s => s.id === goal.stamp_id)
    return { goal, budget, stamp }
  }).filter(({ budget }) => budget)

  return (
    <div style={{
      height: 36, flexShrink: 0,
      borderTop: "1px solid rgba(44,26,14,0.1)",
      display: "flex", alignItems: "center",
      padding: "0 16px",
      gap: 0,
      overflowX: "auto",
      scrollbarWidth: "none",
      background: "rgba(44,26,14,0.025)",
    }}>
      <span style={{
        fontFamily: "var(--font-hand)", fontSize: 12,
        color: SAGE, opacity: 0.7,
        flexShrink: 0, marginRight: 10,
      }}>
        weekly targets —
      </span>

      {items.length === 0 && (
        <span style={{ fontFamily: "var(--font-type)", fontSize: 8, color: INK, opacity: 0.3, letterSpacing: "1px" }}>
          drag stamps to the board to set targets
        </span>
      )}

      {items.map(({ goal, budget, stamp }, i) => {
        if (!budget) return null
        const isOver = budget.allocated >= budget.total + budget.rollover
        return (
          <span key={goal.id} style={{ display: "flex", alignItems: "center", gap: 0, flexShrink: 0 }}>
            {i > 0 && (
              <span style={{ color: INK, opacity: 0.2, margin: "0 8px", fontSize: 10 }}>·</span>
            )}
            {stamp?.illustration_url ? (
              <img
                src={stamp.illustration_url} alt="" draggable={false}
                style={{ width: 14, height: 14, objectFit: "cover", borderRadius: 1, marginRight: 5, opacity: 0.75 }}
              />
            ) : (
              <span style={{ fontFamily: "var(--font-type)", fontSize: 8, color: INK, opacity: 0.4, marginRight: 4 }}>
                {stamp?.name.slice(0, 4) ?? "—"}
              </span>
            )}
            <span style={{
              fontFamily: "var(--font-type)", fontSize: 9,
              color: isOver ? TERRA : INK,
              opacity: isOver ? 1 : 0.75,
              letterSpacing: "0.5px",
            }}>
              {budget.allocated.toFixed(budget.allocated % 1 === 0 ? 0 : 1)}/{budget.total + budget.rollover} {goal.period_unit}
            </span>
          </span>
        )
      })}
    </div>
  )
}

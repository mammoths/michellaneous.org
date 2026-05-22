import type { TimeWindow } from "@/lib/time"

export type RunEntry = { date: string; miles: number; logged_at?: number }

export type CounterConfig = {
  id: string
  type: "counter"
  label: string
  inkColor: string
  bgColor: string
  format: (n: number) => string
  canIncrement?: boolean
  data: Record<TimeWindow, number>
  log?: RunEntry[]
}

export type BinaryConfig = {
  id: string
  type: "binary"
  label: string
  inkColor: string
  bgColor: string
  data: { today: boolean; week: number; month: number; year: number }
}

export type StampConfig = CounterConfig | BinaryConfig

export const STAMPS: StampConfig[] = [
  {
    id: "run",
    type: "counter",
    label: "miles",
    inkColor: "#2a4a20",
    bgColor: "#c4d8b4",
    format: (n) => n.toFixed(1),
    data: { today: 0, week: 0, month: 0, year: 0 },
    log: [],
  },
  {
    id: "pullups",
    type: "counter",
    label: "pull-ups",
    inkColor: "#1a2a4a",
    bgColor: "#bac4d8",
    format: (n) => String(n),
    canIncrement: true,
    data: { today: 0, week: 0, month: 0, year: 0 },
  },
  {
    id: "viet",
    type: "counter",
    label: "words",
    inkColor: "#8a1010",
    bgColor: "#d8b4b4",
    format: (n) => String(n),
    data: { today: 0, week: 0, month: 0, year: 0 },
  },
  {
    id: "book",
    type: "counter",
    label: "pages",
    inkColor: "#3a2010",
    bgColor: "#d4c8b4",
    format: (n) => String(n),
    data: { today: 0, week: 0, month: 0, year: 0 },
  },
  {
    id: "pilates",
    type: "binary",
    label: "pilates",
    inkColor: "#1a4030",
    bgColor: "#b4ccbf",
    data: { today: false, week: 0, month: 0, year: 0 },
  },
  {
    id: "aerials",
    type: "binary",
    label: "aerials",
    inkColor: "#3a1a5a",
    bgColor: "#cabcd4",
    data: { today: false, week: 0, month: 0, year: 0 },
  },
  {
    id: "meili",
    type: "binary",
    label: "meili",
    inkColor: "#7a4a10",
    bgColor: "#dccca8",
    data: { today: false, week: 0, month: 0, year: 0 },
  },
  {
    id: "biked",
    type: "binary",
    label: "biked",
    inkColor: "#2a4020",
    bgColor: "#c8d4b8",
    data: { today: false, week: 0, month: 0, year: 0 },
  },
]

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
  imageUrl?: string
  data: Record<TimeWindow, number>
  log?: RunEntry[]
}

export type BinaryConfig = {
  id: string
  type: "binary"
  label: string
  inkColor: string
  bgColor: string
  imageUrl?: string
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
    imageUrl: "/stamps/reading1.png",
    format: (n) => String(n),
    data: { today: 0, week: 0, month: 0, year: 0 },
  },
  {
    id: "pilates",
    type: "binary",
    label: "pilates",
    inkColor: "#1a4030",
    bgColor: "#b4ccbf",
    imageUrl: "/stamps/pilates1.png",
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
    id: "building",
    type: "binary",
    label: "building",
    inkColor: "#3a2a5a",
    bgColor: "#cabcd4",
    data: { today: false, week: 0, month: 0, year: 0 },
  },
  {
    id: "coffee",
    type: "binary",
    label: "coffee",
    inkColor: "#5a3010",
    bgColor: "#d4b896",
    imageUrl: "/stamps/coffee.png",
    data: { today: false, week: 0, month: 0, year: 0 },
  },
  {
    id: "boardgames",
    type: "binary",
    label: "boardgames",
    inkColor: "#2a3a5a",
    bgColor: "#b8c4d8",
    imageUrl: "/stamps/boardgames1.png",
    data: { today: false, week: 0, month: 0, year: 0 },
  },
  {
    id: "crabbing",
    type: "binary",
    label: "crabbing",
    inkColor: "#5a2a10",
    bgColor: "#d4b8a0",
    data: { today: false, week: 0, month: 0, year: 0 },
  },
]

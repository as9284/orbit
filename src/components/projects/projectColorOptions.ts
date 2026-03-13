import type { ProjectColor } from "../../types/database.types";

export const PROJECT_COLOR_OPTIONS: {
  value: ProjectColor;
  label: string;
  bg: string;
  ring: string;
}[] = [
  {
    value: "violet",
    label: "Violet",
    bg: "bg-violet-500",
    ring: "ring-violet-400",
  },
  {
    value: "purple",
    label: "Purple",
    bg: "bg-purple-500",
    ring: "ring-purple-400",
  },
  {
    value: "indigo",
    label: "Indigo",
    bg: "bg-indigo-500",
    ring: "ring-indigo-400",
  },
  { value: "blue", label: "Blue", bg: "bg-blue-500", ring: "ring-blue-400" },
  { value: "sky", label: "Sky", bg: "bg-sky-500", ring: "ring-sky-400" },
  { value: "cyan", label: "Cyan", bg: "bg-cyan-500", ring: "ring-cyan-400" },
  { value: "teal", label: "Teal", bg: "bg-teal-500", ring: "ring-teal-400" },
  {
    value: "emerald",
    label: "Emerald",
    bg: "bg-emerald-500",
    ring: "ring-emerald-400",
  },
  { value: "lime", label: "Lime", bg: "bg-lime-500", ring: "ring-lime-400" },
  {
    value: "amber",
    label: "Amber",
    bg: "bg-amber-500",
    ring: "ring-amber-400",
  },
  {
    value: "orange",
    label: "Orange",
    bg: "bg-orange-500",
    ring: "ring-orange-400",
  },
  { value: "red", label: "Red", bg: "bg-red-500", ring: "ring-red-400" },
  { value: "rose", label: "Rose", bg: "bg-rose-500", ring: "ring-rose-400" },
  { value: "pink", label: "Pink", bg: "bg-pink-500", ring: "ring-pink-400" },
  {
    value: "fuchsia",
    label: "Fuchsia",
    bg: "bg-fuchsia-500",
    ring: "ring-fuchsia-400",
  },
];

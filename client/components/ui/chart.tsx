import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label: ReactNode; color: string }>;

export function ChartContainer({ config, children, className, style, ...props }: ComponentProps<"div"> & {
  config: ChartConfig;
  children: ComponentProps<typeof ResponsiveContainer>["children"];
}) {
  const colors = Object.fromEntries(Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]));
  return (
    <div data-slot="chart" className={cn("min-w-0 text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-border", className)}
      style={{ ...colors, ...style } as CSSProperties} {...props}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>{children}</ResponsiveContainer>
    </div>
  );
}

export const ChartTooltip = Tooltip;

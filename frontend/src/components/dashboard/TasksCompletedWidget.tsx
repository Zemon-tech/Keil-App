import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart";
import { useTasksCompletedDaily } from "@/hooks/api/useAnalytics";

interface TasksCompletedWidgetProps {
    orgId: string | null;
    spaceId: string | null;
    days?: number;
}

const chartConfig = {
    value: {
        label: "Tasks completed",
        color: "hsl(var(--primary))",
    },
} satisfies ChartConfig;

export function TasksCompletedWidget({ orgId, spaceId, days = 30 }: TasksCompletedWidgetProps) {
    const { data, isLoading, isError } = useTasksCompletedDaily(orgId, spaceId, days);

    if (isLoading) {
        return (
            <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 gap-2">
                <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="size-3.5 rounded-full" />
                    <Skeleton className="h-2.5 w-32" />
                </div>
                <Skeleton className="h-32 w-full" />
            </Card>
        );
    }

    if (isError || !data) {
        return (
            <Card className="bg-card/90 border border-border/60 rounded-2xl p-4 flex items-center justify-center text-muted-foreground text-xs italic">
                Couldn't load this metric
            </Card>
        );
    }

    const total = data.reduce((sum, point) => sum + point.value, 0);

    return (
        <Card
            className={cn(
                "bg-card/90 border border-border/60 rounded-2xl shadow-sm",
                "p-4 gap-2"
            )}
        >
            <h3 className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-bold mb-1 flex items-center gap-2">
                <BarChart3 className="size-3.5" />
                Tasks Completed
            </h3>
            <p className="text-2xl font-semibold text-foreground leading-tight">{total}</p>
            <p className="text-[10px] text-muted-foreground mb-2">last {days} days</p>

            {data.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-xs italic">
                    No completed tasks yet
                </div>
            ) : (
                <ChartContainer config={chartConfig} className="h-32 w-full">
                    <BarChart data={data}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="bucket_date"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value: string) => value.slice(5)} // MM-DD
                            fontSize={10}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
                    </BarChart>
                </ChartContainer>
            )}
        </Card>
    );
}

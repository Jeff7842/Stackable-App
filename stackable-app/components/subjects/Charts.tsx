"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type SubjectPerformanceChartProps = {
  points: Array<{
    label: string;
    averageScore: number | null;
    recentAverage: number | null;
  }>;
};

type TeacherStudentRatioChartProps = {
  teacherCount: number;
  studentCount: number;
};

export function SubjectPerformanceChart({ points }: SubjectPerformanceChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const chartOptions: ApexCharts.ApexOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "inherit",
      background: "transparent",
      foreColor: isDark ? "#c4d1cb" : "#4b5563",
    },
    stroke: {
      curve: "smooth",
      width: 3,
    },
    colors: ["#F19F24", "#108548"],
    grid: {
      borderColor: isDark ? "rgba(196, 209, 203, 0.14)" : "#e5e7eb",
      strokeDashArray: 4,
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
    },
    xaxis: {
      categories: points.map((point) => point.label),
      labels: {
        style: { colors: isDark ? "#9fb0a8" : "#6b7280" },
      },
    },
    yaxis: {
      labels: {
        style: { colors: isDark ? "#9fb0a8" : "#6b7280" },
      },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
    },
    theme: {
      mode: isDark ? "dark" : "light",
    },
  };

  const chartSeries = [
    {
      name: "Term average",
      data: points.map((point) => point.averageScore ?? 0),
    },
    {
      name: "Recent submissions",
      data: points.map((point) => point.recentAverage ?? point.averageScore ?? 0),
    },
  ];

  return <Chart options={chartOptions} series={chartSeries} type="line" height={300} />;
}

export function TeacherStudentRatioChart({
  teacherCount,
  studentCount,
}: TeacherStudentRatioChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "donut",
      background: "transparent",
      toolbar: { show: false },
    },
    labels: ["Teachers", "Students"],
    colors: ["#108548", "#F19F24"],
    stroke: {
      colors: [isDark ? "#0f1814" : "#ffffff"],
    },
    legend: {
      position: "bottom",
      labels: {
        colors: isDark ? "#c4d1cb" : "#4b5563",
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (value: number) => `${Math.round(value)}%`,
    },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Learners per teacher",
              formatter: () => {
                if (teacherCount === 0) return "-";
                return `${Math.round((studentCount / teacherCount) * 100) / 100}`;
              },
            },
          },
        },
      },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
    },
  };

  return (
    <Chart
      options={options}
      series={[teacherCount, studentCount]}
      type="donut"
      height={300}
    />
  );
}

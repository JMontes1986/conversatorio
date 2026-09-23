"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScheduleItem = {
  id: string;
  time: string;
  endTime: string;
  activity: string;
  completed?: boolean;
};

type ScheduleData = {
  day1Date: string;
  day2Date: string;
  day1: ScheduleItem[];
  day2: ScheduleItem[];
  day1Published?: boolean;
  day2Published?: boolean;
};

function formatTime(value?: string) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const suffix = h >= 12 ? "p. m." : "a. m.";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function timeLabel(start?: string, end?: string) {
  if (!start) return "";
  return end ? `${formatTime(start)}\n${formatTime(end)}` : formatTime(start);
}

async function imageToDataUrl(src: string) {
  const response = await fetch(src, { cache: "force-cache" });
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function SchedulePdfDownload({ schedule }: { schedule: ScheduleData }) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);

    try {
      const [{ jsPDF }, iconData] = await Promise.all([
        import("jspdf"),
        imageToDataUrl("/conversatorio-icon.png"),
      ]);

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
        compress: true,
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const marginX = 16;
      const contentWidth = pageWidth - marginX * 2;

      const navy: [number, number, number] = [8, 19, 55];
      const blue: [number, number, number] = [66, 86, 190];
      const lime: [number, number, number] = [220, 238, 35];
      const light: [number, number, number] = [247, 248, 251];
      const gray: [number, number, number] = [104, 116, 137];
      const dark: [number, number, number] = [20, 28, 45];
      const green: [number, number, number] = [25, 135, 84];

      const drawFooter = (pageNumber: number) => {
        pdf.setDrawColor(226, 230, 238);
        pdf.line(marginX, 283, pageWidth - marginX, 283);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(...gray);
        pdf.text("Colegio Franciscano Agustín Gemelli · Conversatorio Interno 2026", marginX, 289);
        pdf.text(`Página ${pageNumber}`, pageWidth - marginX, 289, { align: "right" });
      };

      let pageNumber = 1;

      const drawPageHeader = (date: string, dayLabel: string) => {
        pdf.setFillColor(...navy);
        pdf.rect(0, 0, pageWidth, 42, "F");

        pdf.setFillColor(...lime);
        pdf.rect(0, 42, pageWidth, 2.5, "F");

        pdf.addImage(iconData, "PNG", 16, 8, 23, 23);

        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text("COLEGIO FRANCISCANO AGUSTÍN GEMELLI", 45, 13);

        pdf.setFontSize(20);
        pdf.text("CONVERSATORIO INTERNO 2026", 45, 23);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.text("Programación oficial del evento", 45, 31);

        pdf.setTextColor(...dark);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(dayLabel.toUpperCase(), marginX, 57);

        pdf.setFontSize(17);
        pdf.text(date || dayLabel, marginX, 66);

        pdf.setDrawColor(220, 225, 234);
        pdf.line(marginX, 72, pageWidth - marginX, 72);

        return 80;
      };

      const drawDay = (
        date: string,
        dayLabel: string,
        items: ScheduleItem[],
        forceNewPage: boolean,
      ) => {
        if (forceNewPage) {
          pdf.addPage();
          pageNumber += 1;
        }

        let y = drawPageHeader(date, dayLabel);

        items.forEach((item, index) => {
          const activityLines = pdf.splitTextToSize(item.activity || "Actividad sin descripción", 122);
          const activityHeight = Math.max(10, activityLines.length * 5);
          const cardHeight = Math.max(22, activityHeight + 10);

          if (y + cardHeight > 276) {
            drawFooter(pageNumber);
            pdf.addPage();
            pageNumber += 1;
            y = drawPageHeader(date, `${dayLabel} · continuación`);
          }

          const isBreak = /receso|almuerzo|descanso/i.test(item.activity || "");

          pdf.setFillColor(...(isBreak ? [252, 250, 235] as [number, number, number] : light));
          pdf.roundedRect(marginX, y, contentWidth, cardHeight, 2.5, 2.5, "F");

          pdf.setFillColor(...(isBreak ? lime : blue));
          pdf.roundedRect(marginX, y, 39, cardHeight, 2.5, 2.5, "F");

          pdf.setTextColor(...(isBreak ? dark : [255, 255, 255]));
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9.5);

          const times = timeLabel(item.time, item.endTime).split("\n");
          const centerY = y + cardHeight / 2;
          if (times.length > 1) {
            pdf.text(times[0], marginX + 19.5, centerY - 2.5, { align: "center" });
            pdf.setFontSize(7);
            pdf.setFont("helvetica", "normal");
            pdf.text("a", marginX + 19.5, centerY + 0.5, { align: "center" });
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(9.5);
            pdf.text(times[1], marginX + 19.5, centerY + 5, { align: "center" });
          } else {
            pdf.text(times[0] || "—", marginX + 19.5, centerY + 1, { align: "center" });
          }

          pdf.setTextColor(...dark);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10.5);
          pdf.text(activityLines, marginX + 47, y + 8);

          if (item.completed) {
            const badgeText = "COMPLETADO";
            const badgeWidth = 27;
            pdf.setFillColor(231, 247, 239);
            pdf.roundedRect(pageWidth - marginX - badgeWidth - 3, y + cardHeight - 8.5, badgeWidth, 5.5, 2, 2, "F");
            pdf.setTextColor(...green);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(6.5);
            pdf.text(badgeText, pageWidth - marginX - 3 - badgeWidth / 2, y + cardHeight - 4.7, { align: "center" });
          }

          pdf.setTextColor(...gray);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(6.8);
          pdf.text(String(index + 1).padStart(2, "0"), pageWidth - marginX - 3, y + 5, { align: "right" });

          y += cardHeight + 3;
        });

        drawFooter(pageNumber);
      };

      const publishedDays = [
        schedule.day1Published
          ? { date: schedule.day1Date || "Día 1", label: "Día 1", items: schedule.day1 || [] }
          : null,
        schedule.day2Published
          ? { date: schedule.day2Date || "Día 2", label: "Día 2", items: schedule.day2 || [] }
          : null,
      ].filter(Boolean) as Array<{ date: string; label: string; items: ScheduleItem[] }>;

      if (publishedDays.length === 0) {
        publishedDays.push({
          date: schedule.day1Date || "Programación",
          label: "Programación",
          items: schedule.day1 || [],
        });
      }

      publishedDays.forEach((day, index) => {
        drawDay(day.date, day.label, day.items, index > 0);
      });

      pdf.save("programacion-conversatorio-interno-2026.pdf");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button type="button" onClick={handleDownload} disabled={generating} className="gap-2">
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {generating ? "Generando PDF..." : "Descargar programación en PDF"}
    </Button>
  );
}

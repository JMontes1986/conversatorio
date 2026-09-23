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

const BRAND_IMAGE = "data:image/jpeg;base64,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";

function timeLabel(start?: string, end?: string) {
  if (!start) return "";
  const format = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return value;
    const suffix = h >= 12 ? "p. m." : "a. m.";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
  };
  return end ? `${format(start)} - ${format(end)}` : format(start);
}

export function SchedulePdfDownload({ schedule }: { schedule: ScheduleData }) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableModule.default;
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      const drawHeader = (title: string) => {
        pdf.setFillColor(239, 255, 0);
        pdf.rect(0, 0, 210, 38, "F");
        pdf.addImage(BRAND_IMAGE, "JPEG", 65, 5, 80, 29);
        pdf.setTextColor(10, 20, 55);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.text("CONVERSATORIO INTERNO 2026", 105, 46, { align: "center" });
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "normal");
        pdf.text(title, 105, 53, { align: "center" });
      };

      const addDay = (date: string, items: ScheduleItem[], newPage: boolean) => {
        if (newPage) pdf.addPage();
        drawHeader(date);
        autoTable(pdf, {
          startY: 60,
          head: [["Hora", "Actividad"]],
          body: items.map((item) => [
            timeLabel(item.time, item.endTime),
            item.completed ? `✓ ${item.activity}` : item.activity,
          ]),
          theme: "grid",
          styles: { fontSize: 10, cellPadding: 3.2, valign: "middle" },
          headStyles: { fillColor: [9, 23, 64], textColor: [255, 255, 255], fontStyle: "bold" },
          columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 138 } },
          margin: { left: 15, right: 15 },
          didDrawPage: () => {
            pdf.setFontSize(8);
            pdf.setTextColor(90, 90, 90);
            pdf.text("Conversatorio Colgemelli · Programación oficial", 105, 290, { align: "center" });
          },
        });
      };

      let pageAdded = false;
      if (schedule.day1Published) {
        addDay(schedule.day1Date || "Día 1", schedule.day1 || [], pageAdded);
        pageAdded = true;
      }
      if (schedule.day2Published) {
        addDay(schedule.day2Date || "Día 2", schedule.day2 || [], pageAdded);
        pageAdded = true;
      }

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

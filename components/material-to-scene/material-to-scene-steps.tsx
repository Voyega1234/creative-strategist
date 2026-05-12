"use client"

const STEPS = [
  {
    label: "Step 1",
    title: "Upload material",
    description: "ใช้รูปที่ texture หรือผิววัสดุชัดเจน",
  },
  {
    label: "Step 2",
    title: "Write scene brief",
    description: "บอก mood, angle, space และ use case",
  },
  {
    label: "Step 3",
    title: "Generate 4 scenes",
    description: "เลือกภาพที่ดีที่สุดแล้วค่อย download",
  },
]

export function MaterialToSceneSteps() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {STEPS.map((step) => (
        <div key={step.label} className="rounded-[24px] bg-slate-50 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{step.label}</p>
          <p className="mt-2 text-base font-medium text-slate-900">{step.title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p>
        </div>
      ))}
    </div>
  )
}

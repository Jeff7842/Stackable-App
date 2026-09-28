"use client";

/**
 * TimetableEditor - the weekly grid (Monday-Sunday x 07:00-17:00) shared by
 * the teacher edit page and the standalone timetable page. Fully controlled:
 * the parent owns the slot array and decides when/how it is persisted
 * (bundled into a bigger save, or its own PUT .../timetable call).
 *
 * Interaction: click a tile to edit it, "+ Add" (or double-click an empty
 * cell) to create one, drag a tile to a different day / time, delete from the
 * edit drawer (confirmed). New slots get a client-side "temp-" id; the server
 * assigns real ids to the whole set on save, so ids are never sent back.
 */
import { useMemo, useState } from "react";
import { useConfirmation } from "@/components/confirmation/ConfirmationProvider";
import { Button, Drawer, Field, Input, Select, Textarea } from "@/components/ui";
import {
  TIMETABLE_DAYS,
  TIMETABLE_ITEM_TYPES,
  TIMETABLE_SLOT_STARTS,
  type ClassOption,
  type SubjectOption,
  type TimetableItemType,
  type TimetableSlot,
} from "@/hooks/useTeachers";
import { classLabel } from "./utils";

function labelDay(day: string) {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function sortSlots(rows: TimetableSlot[]) {
  return [...rows].sort((a, b) => {
    const dayA = TIMETABLE_DAYS.indexOf(a.day_of_week as (typeof TIMETABLE_DAYS)[number]);
    const dayB = TIMETABLE_DAYS.indexOf(b.day_of_week as (typeof TIMETABLE_DAYS)[number]);
    if (dayA !== dayB) return (dayA === -1 ? 999 : dayA) - (dayB === -1 ? 999 : dayB);
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
  });
}

function tileTone(type: TimetableItemType) {
  switch (type) {
    case "event":
      return "border-info/30 bg-info-tint text-info";
    case "duty":
      return "border-warning/30 bg-warning-tint text-warning";
    case "task":
      return "border-accent/30 bg-accent-tint text-accent-ink";
    default:
      return "border-primary/30 bg-primary-tint text-primary-ink";
  }
}

type SlotForm = {
  item_type: TimetableItemType;
  title: string;
  class_id: string;
  subject_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string;
  notes: string;
};

const EMPTY_FORM: SlotForm = {
  item_type: "class",
  title: "",
  class_id: "",
  subject_id: "",
  day_of_week: "monday",
  start_time: "08:00",
  end_time: "09:00",
  room: "",
  notes: "",
};

export interface TimetableEditorProps {
  slots: TimetableSlot[];
  onChange: (slots: TimetableSlot[]) => void;
  classes: ClassOption[];
  subjects: SubjectOption[];
}

export function TimetableEditor({ slots, onChange, classes, subjects }: TimetableEditorProps) {
  const { confirm } = useConfirmation();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ open: boolean; editingId: string | null; form: SlotForm } | null>(null);

  const grouped = useMemo(() => {
    const groups: Record<string, TimetableSlot[]> = {};
    for (const day of TIMETABLE_DAYS) groups[day] = [];
    for (const slot of slots) {
      const key = slot.day_of_week.toLowerCase();
      (groups[key] ??= []).push(slot);
    }
    return groups;
  }, [slots]);

  function openNew(day?: string, time?: string) {
    setDrawer({
      open: true,
      editingId: null,
      form: { ...EMPTY_FORM, day_of_week: day ?? "monday", start_time: time ?? "08:00" },
    });
  }

  function openEdit(slot: TimetableSlot) {
    setDrawer({
      open: true,
      editingId: slot.id,
      form: {
        item_type: slot.item_type,
        title: slot.title ?? "",
        class_id: slot.class_id ?? "",
        subject_id: slot.subject_id ? String(slot.subject_id) : "",
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        room: slot.room ?? "",
        notes: slot.notes ?? "",
      },
    });
  }

  function closeDrawer() {
    setDrawer((current) => (current ? { ...current, open: false } : current));
  }

  function patchForm(change: Partial<SlotForm>) {
    setDrawer((current) => (current ? { ...current, form: { ...current.form, ...change } } : current));
  }

  function saveSlot() {
    if (!drawer) return;
    const { form, editingId } = drawer;
    const row: TimetableSlot = {
      id: editingId ?? `temp-${Date.now()}`,
      teacher_id: "",
      class_id: form.item_type === "class" ? form.class_id || null : null,
      subject_id: form.item_type === "class" && form.subject_id ? Number(form.subject_id) : null,
      day_of_week: form.day_of_week,
      start_time: form.start_time,
      end_time: form.end_time,
      room: form.room || null,
      item_type: form.item_type,
      title: form.item_type === "class" ? null : form.title || null,
      notes: form.notes || null,
      created_at: null,
    };
    const next = editingId ? slots.map((s) => (s.id === editingId ? row : s)) : [...slots, row];
    onChange(sortSlots(next));
    closeDrawer();
  }

  async function deleteSlot() {
    if (!drawer?.editingId) return;
    const ok = await confirm({
      title: "Delete timetable item?",
      message: "Delete this timetable item from the weekly schedule?",
      confirmLabel: "Delete item",
      cancelLabel: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    onChange(slots.filter((s) => s.id !== drawer.editingId));
    closeDrawer();
  }

  function onDrop(day: string, startTime: string) {
    if (!draggingId) return;
    onChange(sortSlots(slots.map((s) => (s.id === draggingId ? { ...s, day_of_week: day, start_time: startTime } : s))));
    setDraggingId(null);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Drag items between days, click a tile to edit, or add class, event, duty and task blocks.</p>
        <Button size="sm" leftIcon="solar:add-circle-linear" onClick={() => openNew()}>
          Add slot
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[1000px] grid-cols-[88px_repeat(7,1fr)] gap-2">
          <div />
          {TIMETABLE_DAYS.map((day) => (
            <div key={day} className="rounded-xl bg-recessed px-2 py-2.5 text-center text-xs font-semibold tracking-wide text-ink-soft uppercase">
              {labelDay(day)}
            </div>
          ))}

          {TIMETABLE_SLOT_STARTS.map((slotStart) => (
            <div key={`row-${slotStart}`} className="contents">
              <div className="flex items-center rounded-xl bg-canvas px-2 text-xs font-semibold text-muted tabular-nums">{slotStart}</div>
              {TIMETABLE_DAYS.map((day) => {
                const items = (grouped[day] ?? []).filter((s) => s.start_time === slotStart);
                return (
                  <div
                    key={`${day}-${slotStart}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onDrop(day, slotStart)}
                    onDoubleClick={() => openNew(day, slotStart)}
                    className="min-h-[80px] rounded-xl bg-canvas p-1.5 ring-1 ring-inset ring-ghost/60"
                  >
                    <div className="flex h-full flex-col gap-1.5">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          draggable
                          onDragStart={() => setDraggingId(item.id)}
                          onClick={() => openEdit(item)}
                          className={`rounded-lg border px-2 py-1.5 text-left text-[11px] font-semibold ${tileTone(item.item_type)}`}
                        >
                          <div className="truncate">
                            {item.item_type === "class" ? classLabel(classes.find((c) => c.id === item.class_id)) : item.title || item.item_type}
                          </div>
                          <div className="mt-0.5 truncate text-[10px] font-medium opacity-80">
                            {item.start_time}–{item.end_time}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <Drawer
        open={Boolean(drawer?.open)}
        onClose={closeDrawer}
        size="sm"
        title={drawer?.editingId ? "Edit timetable item" : "Add timetable item"}
        footer={
          <>
            {drawer?.editingId ? (
              <Button variant="ghost" leftIcon="solar:trash-bin-trash-linear" onClick={() => void deleteSlot()} className="mr-auto text-danger">
                Delete
              </Button>
            ) : null}
            <Button variant="ghost" onClick={closeDrawer}>
              Cancel
            </Button>
            <Button onClick={saveSlot}>Save item</Button>
          </>
        }
      >
        {drawer ? (
          <div className="space-y-4">
            <Field label="Item type">
              <Select value={drawer.form.item_type} onChange={(e) => patchForm({ item_type: e.target.value as TimetableItemType })}>
                {TIMETABLE_ITEM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Day">
                <Select value={drawer.form.day_of_week} onChange={(e) => patchForm({ day_of_week: e.target.value })}>
                  {TIMETABLE_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {labelDay(day)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Room / location">
                <Input value={drawer.form.room} onChange={(e) => patchForm({ room: e.target.value })} />
              </Field>
              <Field label="Start time">
                <Input type="time" value={drawer.form.start_time} onChange={(e) => patchForm({ start_time: e.target.value })} />
              </Field>
              <Field label="End time">
                <Input type="time" value={drawer.form.end_time} onChange={(e) => patchForm({ end_time: e.target.value })} />
              </Field>
            </div>

            {drawer.form.item_type === "class" ? (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Class">
                  <Select value={drawer.form.class_id} onChange={(e) => patchForm({ class_id: e.target.value })}>
                    <option value="">Select class</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Subject">
                  <Select value={drawer.form.subject_id} onChange={(e) => patchForm({ subject_id: e.target.value })}>
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.subject_name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : (
              <Field label="Title">
                <Input
                  value={drawer.form.title}
                  placeholder="e.g. Assembly duty, Parent meeting, Marking task"
                  onChange={(e) => patchForm({ title: e.target.value })}
                />
              </Field>
            )}

            <Field label="Notes">
              <Textarea rows={3} value={drawer.form.notes} onChange={(e) => patchForm({ notes: e.target.value })} />
            </Field>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

export default TimetableEditor;

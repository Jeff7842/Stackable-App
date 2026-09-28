"use client";

// "My subjects": one small tile per subject (teacher, latest letter, direction of travel).
// On the student home each tile links to the grades page filtered to that subject
// (/learn/grades?subject=...), so the hover lift is honest: it is a real link. The parent
// portal passes `linkFor={() => null}`: tiles then render as plain, non-lifting blocks.
// Averages show only when they exist. The panel is a CSS container, so the grid goes to two
// columns when the PANEL is wide, not the viewport (works with and without a right rail).

import type { CSSProperties } from "react";
import Link from "next/link";
import { Button, Icon } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatPct, type SubjectCard } from "./helpers";
import { GradeLetter, TINT, TrendMark, type Tint } from "./parts";
import { Panel, PanelEmpty, stagger } from "./Panel";

// Rotating pastel tints so a grid of subjects reads as friendly, not as one flat colour.
const ROTATION: Tint[] = ["primary", "info", "accent", "success"];

const TILE = "flex items-center gap-3 rounded-2xl bg-recessed/60 p-3.5";

function TileBody({ card, tint }: { card: SubjectCard; tint: Tint }) {
  const t = TINT[tint];
  return (
    <>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", t.bg, t.ink)}>
        <Icon icon="solar:book-2-linear" width={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[0.95rem] font-semibold text-ink">{card.name}</span>
        <span className="mt-0.5 block truncate text-xs text-ink-soft">{card.teacherName ?? "Teacher not assigned yet"}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <TrendMark trend={card.trend} />
          {card.averagePct != null ? (
            <span className="text-xs font-medium tabular-nums text-ink-soft">{formatPct(card.averagePct)} avg</span>
          ) : null}
        </span>
      </span>
      <GradeLetter grade={card.latestGrade} />
    </>
  );
}

function SubjectTile({ card, tint, href }: { card: SubjectCard; tint: Tint; href: string | null }) {
  if (!href) {
    return (
      <div className={TILE}>
        <TileBody card={card} tint={tint} />
      </div>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        TILE,
        "transition-[translate,box-shadow] duration-300 ease-standard hover:-translate-y-0.5 hover:shadow-lift",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
    >
      <TileBody card={card} tint={tint} />
    </Link>
  );
}

/** Default tile link: the student's grades page filtered to the subject. */
const studentLink = (card: SubjectCard) => `/learn/grades?subject=${encodeURIComponent(card.name)}`;

export function SubjectsGrid({
  cards,
  title = "My subjects",
  description = "Your latest letter in each subject. Tap one to see its grades.",
  linkFor = studentLink,
  allHref = "/learn/grades",
  emptyText = "No subjects yet. They appear here once your school enrols you in them.",
  className,
  style,
}: {
  cards: SubjectCard[];
  title?: string;
  description?: string;
  /** Where a tile goes; return null for a non-interactive tile. */
  linkFor?: (card: SubjectCard) => string | null;
  /** "All grades" button in the panel header; null hides it. */
  allHref?: string | null;
  emptyText?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Panel
      title={title}
      description={cards.length > 0 ? description : undefined}
      className={cn("@container", className)}
      style={style}
      action={
        allHref ? (
          <Button as="a" href={allHref} variant="ghost" size="sm" rightIcon="solar:arrow-right-linear">
            All grades
          </Button>
        ) : undefined
      }
    >
      {cards.length === 0 ? (
        <PanelEmpty icon="solar:book-2-linear">{emptyText}</PanelEmpty>
      ) : (
        <ul className="grid gap-3 @xl:grid-cols-2">
          {cards.map((card, i) => (
            <li key={card.key} style={stagger(i, 40)} className="animate-fade-up">
              <SubjectTile card={card} tint={ROTATION[i % ROTATION.length]} href={linkFor(card)} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

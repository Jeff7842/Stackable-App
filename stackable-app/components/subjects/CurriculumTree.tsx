"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { classNames } from "@/lib/subjects";
import type { CourseworkOutlineNode } from "@/lib/subjects";

type CurriculumTreeProps = {
  nodes: CourseworkOutlineNode[];
  currentNodeId: string | null;
};

function TreeNode({
  node,
  currentNodeId,
}: {
  node: CourseworkOutlineNode;
  currentNodeId: string | null;
}) {
  const [open, setOpen] = useState(true);
  const isCurrent = currentNodeId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div className="subject-tree-node pl-4">
      <div className="flex items-start gap-3">
        <div
          className={classNames(
            "subject-tree-indicator mt-1.5 h-4 w-4 rounded-full border transition",
            node.completionState === "complete" && "border-green-500 bg-green-500",
            node.completionState === "partial" && "border-slate-300 bg-slate-200",
            node.completionState === "pending" && "subject-tree-pulse border-amber-300 bg-[#FFF4E2]",
            isCurrent && "ring-4 ring-[#F7F9E2]",
          )}
        />

        <div className="min-w-0 flex-1 pb-4">
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:text-gray-900"
              >
                <ChevronDown
                  className={classNames("h-4 w-4 transition", !open && "-rotate-90")}
                />
              </button>
            ) : (
              <span className="inline-flex h-6 w-6" />
            )}

            <div>
              <div
                className={classNames(
                  "font-semibold",
                  node.completionState === "complete" && "text-green-700 line-through",
                  node.completionState === "partial" && "text-slate-400 line-through",
                  node.completionState === "pending" && "text-gray-800",
                  isCurrent && "text-[#007146]",
                )}
              >
                {node.title}
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                {node.nodeType}
              </p>
            </div>
          </div>

          {hasChildren && open ? (
            <div className="subject-tree-children mt-3 space-y-1">
              {node.children.map((child) => (
                <TreeNode key={child.id} node={child} currentNodeId={currentNodeId} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function CurriculumTree({ nodes, currentNodeId }: CurriculumTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
        No curriculum topics have been added for this class yet.
      </div>
    );
  }

  return (
    <div className="subject-tree-shell rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm">
      {nodes.map((node) => (
        <TreeNode key={node.id} node={node} currentNodeId={currentNodeId} />
      ))}
    </div>
  );
}

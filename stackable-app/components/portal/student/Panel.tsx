// Panel primitives (card + header, quiet empty block, page-level error + Retry, stagger
// delay, live dot) shared with the teacher portal so every portal looks the same.
// One seam: if the teacher Panel ever moves, only this re-export changes.
export { LiveDot, Panel, PanelEmpty, QueryError, stagger } from "@/components/portal/teacher/Panel";

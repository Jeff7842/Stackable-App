import type { Pool } from "pg";
import { withSchool } from "@stackable/service-kit";
import type { GateState } from "./gate";
import type { AiPolicy, AllowanceTier } from "./policy";
import type { LedgerEntry } from "./points";
import type { MessageRecord, PracticeItem, Session, Store, UsageCounts } from "./store";

interface SessionRow {
  id: string;
  student_id: string;
  question_id: string;
  kind: "tutor" | "tool";
  state: GateState;
  hints_used: number;
  practice_completed: boolean;
  version: number;
}

const toSession = (r: SessionRow): Session => ({
  id: r.id,
  studentId: r.student_id,
  questionId: r.question_id,
  kind: r.kind,
  state: r.state,
  hintsUsed: r.hints_used,
  practiceCompleted: r.practice_completed,
  version: r.version,
});

/** Postgres store; every call runs inside withSchool so row-level security applies. */
export class PgStore implements Store {
  constructor(private readonly pool: Pool) {}

  async getPolicy(schoolId: string): Promise<AiPolicy | null> {
    return withSchool(this.pool, schoolId, async (db) => {
      const { rows } = await db.query(
        `select hints_per_question, practice_items, unaided_points, practice_set_points, daily_allowance_base
           from ai.ai_policies where school_id = $1`,
        [schoolId],
      );
      const r = rows[0];
      if (!r) return null;
      return {
        hintsPerQuestion: r.hints_per_question,
        practiceItems: r.practice_items,
        unaidedPoints: r.unaided_points,
        practiceSetPoints: r.practice_set_points,
        dailyAllowanceBase: r.daily_allowance_base,
      };
    });
  }

  async listTiers(schoolId: string): Promise<AllowanceTier[]> {
    return withSchool(this.pool, schoolId, async (db) => {
      const { rows } = await db.query(
        "select min_points, daily_requests from ai.allowance_tiers where school_id = $1 order by min_points limit 100",
        [schoolId],
      );
      return rows.map((r) => ({ minPoints: r.min_points, dailyRequests: r.daily_requests }));
    });
  }

  async getSession(schoolId: string, studentId: string, questionId: string): Promise<Session | null> {
    return withSchool(this.pool, schoolId, async (db) => {
      const { rows } = await db.query(
        `select id, student_id, question_id, kind, state, hints_used, practice_completed, version
           from ai.ai_sessions where school_id = $1 and student_id = $2 and question_id = $3`,
        [schoolId, studentId, questionId],
      );
      return rows[0] ? toSession(rows[0]) : null;
    });
  }

  async saveSession(schoolId: string, s: Session, expectedVersion: number | null): Promise<boolean> {
    return withSchool(this.pool, schoolId, async (db) => {
      if (expectedVersion === null) {
        const res = await db.query(
          `insert into ai.ai_sessions (id, school_id, student_id, question_id, kind, state, hints_used, practice_completed, version)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           on conflict (school_id, student_id, question_id) do nothing`,
          [s.id, schoolId, s.studentId, s.questionId, s.kind, JSON.stringify(s.state), s.hintsUsed, s.practiceCompleted, s.version],
        );
        return res.rowCount === 1;
      }
      const res = await db.query(
        `update ai.ai_sessions
            set state = $1, hints_used = $2, practice_completed = $3, version = $4, updated_at = now()
          where school_id = $5 and id = $6 and version = $7`,
        [JSON.stringify(s.state), s.hintsUsed, s.practiceCompleted, s.version, schoolId, s.id, expectedVersion],
      );
      return res.rowCount === 1;
    });
  }

  async addMessage(schoolId: string, m: MessageRecord): Promise<void> {
    await withSchool(this.pool, schoolId, (db) =>
      db.query(
        `insert into ai.ai_messages (id, school_id, session_id, role, content, leak_flagged, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [m.id, schoolId, m.sessionId, m.role, m.content, m.leakFlagged, m.createdAt],
      ),
    );
  }

  async countReplies(schoolId: string, studentId: string, from: Date, to: Date): Promise<number> {
    return withSchool(this.pool, schoolId, async (db) => {
      const { rows } = await db.query(
        `select count(*)::int as n
           from ai.ai_messages m join ai.ai_sessions s on s.id = m.session_id and s.school_id = m.school_id
          where m.school_id = $1 and s.student_id = $2 and m.role = 'assistant'
            and m.created_at >= $3 and m.created_at < $4`,
        [schoolId, studentId, from, to],
      );
      return rows[0].n;
    });
  }

  async savePracticeSet(schoolId: string, sessionId: string, items: PracticeItem[]): Promise<void> {
    await withSchool(this.pool, schoolId, async (db) => {
      const setId = crypto.randomUUID();
      await db.query("insert into ai.practice_sets (id, school_id, session_id) values ($1, $2, $3)", [
        setId,
        schoolId,
        sessionId,
      ]);
      for (const i of items) {
        await db.query(
          `insert into ai.practice_items (id, school_id, set_id, position, question, answer_key, difficulty)
           values ($1, $2, $3, $4, $5, $6, $7)`,
          [i.id, schoolId, setId, i.position, i.question, i.answerKey, i.difficulty],
        );
      }
    });
  }

  async getPracticeItems(schoolId: string, sessionId: string): Promise<PracticeItem[]> {
    return withSchool(this.pool, schoolId, async (db) => {
      const { rows } = await db.query(
        `select i.id, i.position, i.question, i.answer_key, i.difficulty
           from ai.practice_items i
          where i.school_id = $1 and i.set_id = (
                select id from ai.practice_sets where school_id = $1 and session_id = $2
                 order by created_at desc limit 1)
          order by i.position limit 50`,
        [schoolId, sessionId],
      );
      return rows.map((r) => ({
        id: r.id,
        position: r.position,
        question: r.question,
        answerKey: r.answer_key,
        difficulty: r.difficulty,
      }));
    });
  }

  async appendPoints(schoolId: string, e: LedgerEntry): Promise<boolean> {
    return withSchool(this.pool, schoolId, async (db) => {
      const res = await db.query(
        `insert into ai.achievement_ledger (id, school_id, student_id, question_id, reason, points, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (school_id, student_id, question_id, reason) do nothing`,
        [e.id, schoolId, e.studentId, e.questionId, e.reason, e.points, e.createdAt],
      );
      return res.rowCount === 1;
    });
  }

  async sumPoints(schoolId: string, studentId: string): Promise<number> {
    return withSchool(this.pool, schoolId, async (db) => {
      const { rows } = await db.query(
        "select coalesce(sum(points), 0)::int as total from ai.achievement_ledger where school_id = $1 and student_id = $2",
        [schoolId, studentId],
      );
      return rows[0].total;
    });
  }

  async usageCounts(schoolId: string, studentId: string): Promise<UsageCounts> {
    return withSchool(this.pool, schoolId, async (db) => {
      const { rows } = await db.query(
        `select count(*) filter (where hints_used > 0)::int as questions_helped,
                coalesce(sum(hints_used), 0)::int as hints_used,
                count(*) filter (where practice_completed)::int as practice_done
           from ai.ai_sessions where school_id = $1 and student_id = $2 and kind = 'tutor'`,
        [schoolId, studentId],
      );
      const r = rows[0];
      return { questionsHelped: r.questions_helped, hintsUsed: r.hints_used, practiceDone: r.practice_done };
    });
  }
}

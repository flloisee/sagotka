import { listResponses, countResponses } from './repo.js';
import {
  type Form,
  type AnswerValue,
  type Summary,
  type QuestionSummary,
  gradeQuestion,
} from '@sagotka/shared';

function isEmpty(v: AnswerValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

export function buildSummary(form: Form): Summary {
  const responses = listResponses(form.id);
  const total = countResponses(form.id);

  const summaries: QuestionSummary[] = form.questions
    .filter((q) => q.type !== 'section_break')
    .map((q) => {
      const values = responses
        .map((r) => r.answers[q.id] ?? null)
        .filter((v): v is AnswerValue => v !== undefined);
      const answered = values.filter((v) => !isEmpty(v));
      const base: QuestionSummary = {
        questionId: q.id,
        type: q.type,
        title: q.title,
        answered: answered.length,
        skipped: total - answered.length,
        recentValues: answered.slice(0, 5),
      };

      if (form.settings.quiz) {
        const graded = answered.map((v) => gradeQuestion(q, v));
        const correctCount = graded.filter((g) => g.correct === true).length;
        const gradedPoints = graded.filter((g) => g.correct !== null);
        base.correctCount = correctCount;
        if (gradedPoints.length > 0) {
          base.totalPoints = gradedPoints.reduce((s, g) => s + g.points, 0);
          base.earnedPoints = gradedPoints.reduce((s, g) => s + g.earned, 0);
        }
      }

      if (q.type === 'multiple_choice' || q.type === 'dropdown') {
        base.choiceStats = q.options.map((o) => {
          const count = answered.filter((v) => v === o.id).length;
          return {
            optionId: o.id,
            label: o.label,
            count,
            percent: answered.length > 0 ? Math.round((count / answered.length) * 100) : 0,
          };
        });
      } else if (q.type === 'checkbox') {
        base.choiceStats = q.options.map((o) => {
          const count = answered.filter(
            (v) => Array.isArray(v) && (v as string[]).includes(o.id),
          ).length;
          return {
            optionId: o.id,
            label: o.label,
            count,
            percent: answered.length > 0 ? Math.round((count / answered.length) * 100) : 0,
          };
        });
      }

      return base;
    });

  return {
    formId: form.id,
    responseCount: total,
    questions: summaries,
  };
}

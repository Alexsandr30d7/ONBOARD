import ast
from dataclasses import dataclass
from datetime import date
from typing import List, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas


@dataclass(frozen=True)
class EWSWeights:
    overdue_ratio: float = 0.35
    pace_drop: float = 0.25
    inactivity: float = 0.20
    negative_feedback: float = 0.20


class FeedbackSignalAnalyzer:
    _NEGATIVE_WORDS: Sequence[str] = (
        "bad",
        "poor",
        "awful",
        "negative",
        "плохо",
        "ужасно",
        "стресс",
        "тяжело",
    )

    def has_negative_feedback(self, raw_responses: str) -> bool:
        lowered = raw_responses.lower()
        if any(word in lowered for word in self._NEGATIVE_WORDS):
            return True

        try:
            parsed = ast.literal_eval(raw_responses)
        except (ValueError, SyntaxError):
            return False

        if not isinstance(parsed, dict):
            return False

        for value in parsed.values():
            if isinstance(value, (int, float)) and value <= 2:
                return True
            if isinstance(value, str) and value.lower() in self._NEGATIVE_WORDS:
                return True
        return False


class EWSScoreCalculator:
    def __init__(self, weights: EWSWeights | None = None) -> None:
        self.weights = weights or EWSWeights()

    def score(
        self,
        overdue_ratio: int,
        pace_drop: int,
        inactivity_days: int,
        negative_feedback: bool,
    ) -> int:
        inactivity_norm = min(100, inactivity_days * 5)
        negative_feedback_score = 100 if negative_feedback else 0
        raw_score = (
            self.weights.overdue_ratio * overdue_ratio
            + self.weights.pace_drop * pace_drop
            + self.weights.inactivity * inactivity_norm
            + self.weights.negative_feedback * negative_feedback_score
        )
        return min(100, max(0, int(round(raw_score))))

    @staticmethod
    def level(score: int) -> str:
        if score >= 70:
            return "high"
        if score >= 40:
            return "medium"
        return "low"


class OnboardingEWSService:
    def __init__(
        self,
        db: AsyncSession,
        score_calculator: EWSScoreCalculator | None = None,
        feedback_analyzer: FeedbackSignalAnalyzer | None = None,
    ) -> None:
        self.db = db
        self.score_calculator = score_calculator or EWSScoreCalculator()
        self.feedback_analyzer = feedback_analyzer or FeedbackSignalAnalyzer()

    async def list_risks(self) -> List[schemas.OnboardingRisk]:
        result = await self.db.execute(
            select(models.EmployeeOnboarding).where(models.EmployeeOnboarding.status == "in_progress")
        )
        active_onboardings = result.scalars().all()

        risks: list[schemas.OnboardingRisk] = []
        today = date.today()
        for onboarding in active_onboardings:
            risk = await self._build_risk_row(onboarding, today=today)
            if risk:
                risks.append(risk)

        risks.sort(key=lambda item: item.risk_score, reverse=True)
        return risks

    async def _build_risk_row(
        self,
        onboarding: models.EmployeeOnboarding,
        today: date,
    ) -> schemas.OnboardingRisk | None:
        employee = await crud.get_employee_by_id(self.db, onboarding.employee_id)
        track = await crud.get_track_by_id(self.db, onboarding.track_id)
        if not employee or not track:
            return None

        tasks = await crud.get_tasks_by_track(self.db, onboarding.track_id)
        total_tasks = len(tasks)
        task_ids = {task.task_id for task in tasks}

        completions_result = await self.db.execute(
            select(models.TaskCompletion).where(models.TaskCompletion.onboarding_id == onboarding.onboarding_id)
        )
        completions = completions_result.scalars().all()
        relevant_completions = [c for c in completions if c.task_id in task_ids]

        completed_count = sum(1 for c in relevant_completions if c.status == "completed")
        overdue_count = sum(
            1 for c in relevant_completions if c.status != "completed" and c.due_date < today
        )
        overdue_ratio = int(round((overdue_count / total_tasks) * 100)) if total_tasks else 0

        elapsed_days = max((today - onboarding.start_date).days, 0)
        expected_ratio = min(1.0, elapsed_days / max(track.duration_days, 1))
        actual_ratio = (completed_count / total_tasks) if total_tasks else 0.0
        pace_drop = int(round(max(0.0, expected_ratio - actual_ratio) * 100))

        completed_dates = [c.completed_date for c in relevant_completions if c.completed_date]
        inactivity_days = max((today - max(completed_dates)).days, 0) if completed_dates else elapsed_days

        feedback_result = await self.db.execute(
            select(models.Feedback)
            .where(models.Feedback.employee_id == employee.employee_id)
            .order_by(models.Feedback.submitted_at.desc())
            .limit(1)
        )
        latest_feedback = feedback_result.scalars().first()
        negative_feedback = (
            self.feedback_analyzer.has_negative_feedback(latest_feedback.responses)
            if latest_feedback
            else False
        )

        score = self.score_calculator.score(
            overdue_ratio=overdue_ratio,
            pace_drop=pace_drop,
            inactivity_days=inactivity_days,
            negative_feedback=negative_feedback,
        )

        return schemas.OnboardingRisk(
            onboarding_id=onboarding.onboarding_id,
            employee_id=employee.employee_id,
            employee_name=f"{employee.first_name} {employee.last_name}",
            track_name=track.name,
            risk_score=score,
            risk_level=self.score_calculator.level(score),
            factors=schemas.OnboardingRiskFactors(
                overdue_ratio=overdue_ratio,
                pace_drop=pace_drop,
                inactivity_days=inactivity_days,
                negative_feedback=negative_feedback,
            ),
        )

import ast
from dataclasses import dataclass
from datetime import date
from typing import List, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, models, schemas


@dataclass(frozen=True)
class EWSWeights:
    overdue_ratio: float = 0.35
    pace_drop: float = 0.25
    inactivity: float = 0.20
    negative_feedback: float = 0.20


CURRENT_EWS_WEIGHTS = EWSWeights()


def get_current_ews_weights() -> EWSWeights:
    return CURRENT_EWS_WEIGHTS


def set_current_ews_weights(weights: EWSWeights) -> EWSWeights:
    global CURRENT_EWS_WEIGHTS
    CURRENT_EWS_WEIGHTS = weights
    return CURRENT_EWS_WEIGHTS


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

    async def preview_distribution(self, weights: EWSWeights | None = None) -> schemas.EWSDistributionPreview:
        selected_weights = weights or self.score_calculator.weights
        preview_service = OnboardingEWSService(
            db=self.db,
            score_calculator=EWSScoreCalculator(selected_weights),
            feedback_analyzer=self.feedback_analyzer,
        )
        risks = await preview_service.list_risks()
        low = len([x for x in risks if x.risk_level == "low"])
        medium = len([x for x in risks if x.risk_level == "medium"])
        high = len([x for x in risks if x.risk_level == "high"])
        avg = round(sum(x.risk_score for x in risks) / len(risks)) if risks else 0
        return schemas.EWSDistributionPreview(low=low, medium=medium, high=high, average_score=avg)

    async def get_risk_detail(self, onboarding_id: int) -> Optional[schemas.OnboardingRiskDetail]:
        onboarding = await crud.get_onboarding_by_id(self.db, onboarding_id)
        if not onboarding or onboarding.status != "in_progress":
            return None
        return await self._build_risk_detail(onboarding, today=date.today())

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
            onboarding_start_date=onboarding.start_date,
            days_in_onboarding=elapsed_days,
            planned_progress=int(round(expected_ratio * 100)),
            actual_progress=int(round(actual_ratio * 100)),
            risk_score=score,
            risk_level=self.score_calculator.level(score),
            factors=schemas.OnboardingRiskFactors(
                overdue_ratio=overdue_ratio,
                pace_drop=pace_drop,
                inactivity_days=inactivity_days,
                negative_feedback=negative_feedback,
            ),
        )

    async def _build_risk_detail(
        self,
        onboarding: models.EmployeeOnboarding,
        today: date,
    ) -> schemas.OnboardingRiskDetail | None:
        risk_row = await self._build_risk_row(onboarding, today=today)
        if not risk_row:
            return None

        employee = await crud.get_employee_by_id(self.db, onboarding.employee_id)
        if not employee:
            return None

        tasks = await crud.get_tasks_by_track(self.db, onboarding.track_id)
        tasks_by_id = {task.task_id: task for task in tasks}

        completions_result = await self.db.execute(
            select(models.TaskCompletion).where(models.TaskCompletion.onboarding_id == onboarding.onboarding_id)
        )
        completions = completions_result.scalars().all()

        overdue_tasks: list[schemas.OverdueTaskInfo] = []
        for completion in completions:
            if completion.status == "completed" or completion.due_date >= today:
                continue
            task = tasks_by_id.get(completion.task_id)
            if not task:
                continue
            overdue_tasks.append(
                schemas.OverdueTaskInfo(
                    task_id=task.task_id,
                    title=task.title,
                    due_date=completion.due_date,
                    status=completion.status,
                )
            )

        last_activity_date = max(
            (completion.completed_date for completion in completions if completion.completed_date),
            default=None,
        )

        feedback_result = await self.db.execute(
            select(models.Feedback)
            .where(models.Feedback.employee_id == employee.employee_id)
            .order_by(models.Feedback.submitted_at.desc())
            .limit(1)
        )
        latest_feedback = feedback_result.scalars().first()
        latest_feedback_excerpt = None
        if latest_feedback and latest_feedback.responses:
            latest_feedback_excerpt = str(latest_feedback.responses)[:300]

        return schemas.OnboardingRiskDetail(
            onboarding_id=risk_row.onboarding_id,
            employee_id=risk_row.employee_id,
            employee_name=risk_row.employee_name,
            track_name=risk_row.track_name,
            status=onboarding.status,
            onboarding_start_date=risk_row.onboarding_start_date,
            days_in_onboarding=risk_row.days_in_onboarding,
            planned_progress=risk_row.planned_progress,
            actual_progress=risk_row.actual_progress,
            risk_score=risk_row.risk_score,
            risk_level=risk_row.risk_level,
            factors=risk_row.factors,
            overdue_tasks=overdue_tasks,
            last_activity_date=last_activity_date,
            latest_feedback_excerpt=latest_feedback_excerpt,
        )

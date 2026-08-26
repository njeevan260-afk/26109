"""Validated clinical-event contracts used by the forecasting pipeline."""

from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class EventStatus(StrEnum):
    SUSPECTED = "SUSPECTED"
    CONFIRMED = "CONFIRMED"
    DISMISSED = "DISMISSED"


class DiagnosisMethod(StrEnum):
    CLINICAL_EXAM = "CLINICAL_EXAM"
    CMT = "CMT"
    SCC = "SCC"
    CULTURE = "CULTURE"
    TREATMENT_RECORD = "TREATMENT_RECORD"
    OTHER = "OTHER"


class MastitisEventInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    animal_id: UUID
    event_time: datetime
    status: EventStatus = EventStatus.SUSPECTED
    diagnosis_method: DiagnosisMethod
    diagnosis_result: str | None = Field(default=None, max_length=500)
    cmt_result: str | None = Field(default=None, max_length=100)
    scc_value: int | None = Field(default=None, ge=0, le=100_000_000)
    clinical_signs: list[str] = Field(default_factory=list, max_length=30)
    confirmed_by: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2_000)

    @model_validator(mode="after")
    def validate_event_evidence(self):
        if self.event_time.tzinfo is None or self.event_time.utcoffset() is None:
            raise ValueError("event_time must include a timezone")
        if self.event_time > datetime.now(timezone.utc).replace(microsecond=0):
            raise ValueError("event_time cannot be in the future")
        if self.diagnosis_method == DiagnosisMethod.SCC and self.scc_value is None:
            raise ValueError("scc_value is required when diagnosis_method is SCC")
        if self.diagnosis_method == DiagnosisMethod.CMT and not self.cmt_result:
            raise ValueError("cmt_result is required when diagnosis_method is CMT")
        if self.status == EventStatus.CONFIRMED:
            if not self.confirmed_by:
                raise ValueError("confirmed_by is required for confirmed events")
            if not self.diagnosis_result:
                raise ValueError("diagnosis_result is required for confirmed events")
        return self

    def to_database_payload(self) -> dict:
        payload = self.model_dump(mode="json")
        payload["animal_id"] = str(self.animal_id)
        payload["event_time"] = self.event_time.astimezone(timezone.utc).isoformat()
        return payload

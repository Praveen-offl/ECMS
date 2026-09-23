"""
auth/schemas.py
================
Request/response contracts for the caregiver auth endpoints. Kept separate
from the Mongo document shape (a plain dict in auth/service.py) the same
way app/schemas.py is kept separate from the SQLAlchemy models.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class CaregiverResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    caregiver: CaregiverResponse

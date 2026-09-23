"""
auth/routes.py
===============
Signup / login / current-session endpoints for caregivers, backed by the
MongoDB `caregivers` collection (see app/mongo.py). Mounted under
/api/v1/auth in main.py.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo.errors import DuplicateKeyError

from app.auth.schemas import CaregiverResponse, LoginRequest, SignupRequest, TokenResponse
from app.auth.security import create_access_token, decode_access_token, hash_password, verify_password
from app.config import settings
from app.mongo import get_users_collection

logger = logging.getLogger("auth")
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_bearer_scheme = HTTPBearer(auto_error=False)


def _to_caregiver_response(doc: dict) -> CaregiverResponse:
    return CaregiverResponse(
        id=str(doc["_id"]),
        full_name=doc["full_name"],
        email=doc["email"],
        created_at=doc["created_at"],
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest) -> TokenResponse:
    users = get_users_collection()

    doc = {
        "full_name": payload.full_name,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = await users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")

    doc["_id"] = result.inserted_id
    token = create_access_token(subject=str(result.inserted_id))

    return TokenResponse(
        access_token=token,
        expires_in_minutes=settings.JWT_EXPIRE_MINUTES,
        caregiver=_to_caregiver_response(doc),
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    users = get_users_collection()
    doc = await users.find_one({"email": payload.email.lower()})

    if not doc or not verify_password(payload.password, doc["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token(subject=str(doc["_id"]))

    return TokenResponse(
        access_token=token,
        expires_in_minutes=settings.JWT_EXPIRE_MINUTES,
        caregiver=_to_caregiver_response(doc),
    )


async def get_current_caregiver(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> CaregiverResponse:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")

    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session.")

    try:
        object_id = ObjectId(payload["sub"])
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")

    users = get_users_collection()
    doc = await users.find_one({"_id": object_id})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Caregiver account no longer exists.")

    return _to_caregiver_response(doc)


@router.get("/me", response_model=CaregiverResponse)
async def me(current_caregiver: CaregiverResponse = Depends(get_current_caregiver)) -> CaregiverResponse:
    return current_caregiver

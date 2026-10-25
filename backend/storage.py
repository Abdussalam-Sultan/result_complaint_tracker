import os
from urllib.parse import quote

import httpx


SIGNED_URL_TTL_SECONDS = 300


class SupabaseStorageError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _storage_settings() -> tuple[str, str, str]:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "")

    if not supabase_url or not service_role_key or not bucket:
        raise SupabaseStorageError(
            "Supabase Storage is not configured. Set SUPABASE_URL, "
            "SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET."
        )

    return supabase_url, service_role_key, bucket


def _storage_request(method: str, endpoint: str, payload: dict | None = None) -> dict:
    supabase_url, service_role_key, _ = _storage_settings()
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            request_options = {"headers": headers}
            if payload is not None:
                request_options["json"] = payload
            response = client.request(
                method,
                f"{supabase_url}/storage/v1/{endpoint}",
                **request_options,
            )
    except httpx.RequestError as exc:
        raise SupabaseStorageError("Could not connect to Supabase Storage.") from exc

    if response.is_error:
        raise SupabaseStorageError(
            f"Supabase Storage returned HTTP {response.status_code}.",
            status_code=response.status_code,
        )

    try:
        return response.json()
    except ValueError as exc:
        raise SupabaseStorageError(
            "Supabase Storage returned an invalid response."
        ) from exc


def _absolute_storage_url(url: str) -> str:
    supabase_url, _, _ = _storage_settings()
    if url.startswith("https://") or url.startswith("http://"):
        return url
    if url.startswith("/storage/v1/"):
        return f"{supabase_url}{url}"
    return f"{supabase_url}/storage/v1/{url.lstrip('/')}"


def create_signed_upload_url(path: str) -> str:
    _, _, bucket = _storage_settings()
    endpoint = (
        f"object/upload/sign/{quote(bucket, safe='')}/"
        f"{quote(path, safe='/')}"
    )
    result = _storage_request("POST", endpoint, {"upsert": False})
    signed_url = result.get("signedURL") or result.get("signedUrl") or result.get("url")
    if not signed_url:
        raise SupabaseStorageError(
            "Supabase Storage did not return a signed upload URL."
        )
    return _absolute_storage_url(signed_url)


def create_signed_download_url(path: str) -> str:
    _, _, bucket = _storage_settings()
    endpoint = (
        f"object/sign/{quote(bucket, safe='')}/"
        f"{quote(path, safe='/')}"
    )
    result = _storage_request(
        "POST",
        endpoint,
        {"expiresIn": SIGNED_URL_TTL_SECONDS},
    )
    signed_url = result.get("signedURL") or result.get("signedUrl") or result.get("url")
    if not signed_url:
        raise SupabaseStorageError(
            "Supabase Storage did not return a signed download URL."
        )
    return _absolute_storage_url(signed_url)


def get_object_metadata(path: str) -> dict:
    _, _, bucket = _storage_settings()
    endpoint = (
        f"object/info/{quote(bucket, safe='')}/"
        f"{quote(path, safe='/')}"
    )
    return _storage_request("GET", endpoint)

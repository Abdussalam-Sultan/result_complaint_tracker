from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import User
from backend.schemas import UserLogin, Token, UserResponse
from backend.auth import verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=Token)
def login(creds: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email.lower().strip()).first()
    if not user or not verify_password(creds.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/demo-users")
def get_demo_users(db: Session = Depends(get_db)):
    """Returns sample users for quick demo role switching"""
    users = db.query(User).order_by(User.id).all()
    # Select key representatives
    results = []
    # 1 Admin
    admin = next((u for u in users if u.role == "admin"), None)
    # 1 HOD
    hod = next((u for u in users if u.role == "hod"), None)
    # Lecturers
    lecturers = [u for u in users if u.role == "lecturer"][:3]
    # Students (pick a few interesting ones: mass group student, multi-issue student, escalated student)
    students = [u for u in users if u.role == "student"][:5]

    for u in [admin, hod] + lecturers + students:
        if u:
            results.append({
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "role": u.role,
                "matric_no": u.matric_no,
                "department": u.department,
            })
    return results

@router.post("/switch-demo/{user_id}", response_model=Token)
def switch_demo_user(user_id: int, db: Session = Depends(get_db)):
    """Fast 1-click switch for evaluation/demo without password friction"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Demo user not found")
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
    }

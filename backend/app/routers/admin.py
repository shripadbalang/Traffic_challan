from collections import Counter, defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import models, schemas
from app.core.security import require_role
from app.services.challan_engine import calculate_risk_score

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/analytics/overview", response_model=schemas.AnalyticsOverview)
def overview(db: Session = Depends(get_db), _admin=Depends(require_role("admin"))):
    total = db.query(models.Challan).count()
    revenue = (
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .filter(models.Payment.status == "success")
        .scalar()
    )
    pending = db.query(models.Challan).filter(models.Challan.status == models.ChallanStatus.pending).count()
    paid = db.query(models.Challan).filter(models.Challan.status == models.ChallanStatus.paid).count()
    disputed = db.query(models.Challan).filter(models.Challan.status == models.ChallanStatus.disputed).count()

    return schemas.AnalyticsOverview(
        total_challans=total,
        total_revenue=float(revenue),
        pending_count=pending,
        paid_count=paid,
        disputed_count=disputed,
    )


@router.get("/analytics/violation-trends")
def violation_trends(db: Session = Depends(get_db), _admin=Depends(require_role("admin"))):
    """Violation-type counts, and a simple weekly time series for the admin charts."""
    type_counts = (
        db.query(models.ViolationType.name, func.count(models.Challan.id))
        .join(models.Challan, models.Challan.violation_type_id == models.ViolationType.id)
        .group_by(models.ViolationType.name)
        .all()
    )

    weekly = (
        db.query(
            func.date_trunc("week", models.Challan.violation_datetime).label("week"),
            func.count(models.Challan.id),
        )
        .group_by("week")
        .order_by("week")
        .all()
    )

    return {
        "by_violation_type": [{"type": t, "count": c} for t, c in type_counts],
        "weekly_trend": [{"week": w.isoformat(), "count": c} for w, c in weekly],
    }


@router.get("/analytics/hotspots")
def violation_hotspots(db: Session = Depends(get_db), _admin=Depends(require_role("admin"))):
    """Grid-based density approximation for a hotspot heatmap.
    Buckets challans by rounded lat/lng into ~1km grid cells and counts density.
    Replace with DBSCAN clustering for a more rigorous version if time allows —
    see Phase 5 notes in the project plan."""
    challans = (
        db.query(models.Challan)
        .filter(models.Challan.latitude.isnot(None), models.Challan.longitude.isnot(None))
        .all()
    )

    grid = defaultdict(int)
    for c in challans:
        # ~0.01 degrees ≈ 1.1km — coarse grid bucket
        key = (round(c.latitude, 2), round(c.longitude, 2))
        grid[key] += 1

    hotspots = [
        {"latitude": lat, "longitude": lng, "violation_count": count}
        for (lat, lng), count in sorted(grid.items(), key=lambda x: -x[1])
    ]
    return {"hotspots": hotspots}


@router.get("/analytics/repeat-offenders")
def repeat_offenders(db: Session = Depends(get_db), _admin=Depends(require_role("admin"))):
    vehicles = db.query(models.Vehicle).all()
    results = []
    for v in vehicles:
        risk = calculate_risk_score(db, v.id)
        if risk["total_violations"] > 0:
            results.append({
                "vehicle_id": v.id,
                "plate_number": v.plate_number,
                "owner_name": v.owner.full_name if v.owner else "Unregistered",
                **risk,
            })

    results.sort(key=lambda x: -x["score"])
    return {"repeat_offenders": results[:50]}  # top 50 for leaderboard

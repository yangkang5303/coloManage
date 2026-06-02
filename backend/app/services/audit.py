from sqlalchemy.orm import Session

from app.models.domain import AuditLog


def audit(db: Session, actor_user_id: int | None, action: str, entity_type: str, entity_id: int | None, after_value=None):
    row = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        after_value=after_value,
    )
    db.add(row)
    db.commit()
    return row

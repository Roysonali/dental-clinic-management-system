# Phase 12: Service Layer — Doctor Management Module

> **Status:** IN REVIEW | **Target Quality Score:** 9.8/10
> **MVP Scope:** Only service methods for Doctor Profile, Specialization, and Schedule management.

---

## 1. Design Patterns

Following `patients/service.py` and `appointments/service.py`:

- Stateless service class with `Session` dependency
- Explicit transaction management (`db.commit()` / `db.rollback()`)
- Domain exception raising (not HTTP exceptions)
- Validation before persistence
- Audit field population (created_by, updated_by)
- Logging at INFO/WARNING/ERROR levels

---

## 2. DoctorService

```python
class DoctorService:
    def __init__(self, db: Session):
        self.db = db
        self.doctor_repo = DoctorRepository(db)
        self.specialization_repo = SpecializationRepository(db)
        self.ds_repo = DoctorSpecializationRepository(db)
        self.schedule_repo = DoctorScheduleRepository(db)
```

### 2.1 Create Doctor

```python
def create_doctor(self, payload: DoctorCreate, created_by: int) -> Doctor:
    """Create a new doctor profile with validation and specialization assignment."""
    try:
        # 1. Validate user exists and has DOCTOR role
        user = self.db.query(User).filter(User.id == payload.user_id).first()
        if not user:
            raise UserNotFound(payload.user_id)
        if not user.role or user.role.name not in DOCTOR_ROLES:
            raise NotADoctorUser(payload.user_id)

        # 2. Check no duplicate user_id
        if self.doctor_repo.get_by_user_id(payload.user_id):
            raise DuplicateDoctorDetected(f"User {payload.user_id} already has a profile")

        # 3. Validate specializations exist
        specialization_ids = payload.specialization_ids
        if payload.primary_specialization_id not in specialization_ids:
            raise DoctorValidationFailed("Primary specialization must be in specialization list")
        for sid in specialization_ids:
            if not self.specialization_repo.get_by_id(sid):
                raise SpecializationNotFound(sid)

        # 4. Generate doctor code
        next_seq = self.doctor_repo.get_next_doctor_code_sequence()
        doctor_code = f"DOC-{next_seq:06d}"

        # 5. Create doctor (identity data resolved through User FK — not duplicated here)
        doctor = Doctor(
            doctor_code=doctor_code,
            user_id=payload.user_id,
            date_of_birth=payload.date_of_birth,
            gender=payload.gender,
            primary_phone=payload.primary_phone,
            address=payload.address,
            qualification=payload.qualification,
            registration_number=payload.registration_number,
            years_of_experience=payload.years_of_experience,
            consultation_fee=payload.consultation_fee,
            consultation_duration=payload.consultation_duration,
            languages_known=payload.languages_known or [],
            profile_photo_url=payload.profile_photo_url,
            biography=payload.biography,
            emergency_contact_name=payload.emergency_contact_name,
            emergency_contact_phone=payload.emergency_contact_phone,
            available_for_appointment=True,
            on_leave=False,
            is_active=True,
            created_by=created_by,
        )
        doctor = self.doctor_repo.create(doctor)

        self.db.commit()
        self.db.refresh(doctor)
        logger.info("Doctor created: id=%s, code=%s, user_id=%d",
                     doctor.id, doctor.doctor_code, payload.user_id)
        return doctor

    except Exception:
        self.db.rollback()
        logger.exception("Failed to create doctor for user_id=%d", payload.user_id)
        raise
```

### 2.2 List/Search Doctors

```python
def list_doctors(
    self,
    search: str | None = None,
    specialization_id: int | None = None,
    is_active: bool | None = None,
    available: bool | None = None,
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "full_name",
    sort_order: str = "asc",
) -> tuple[list[Doctor], int]:
    """List doctors with search, filtering, pagination, and sorting."""
    return self.doctor_repo.list(
        search=search,
        specialization_id=specialization_id,
        is_active=is_active,
        available=available,
        page=page,
        page_size=min(page_size, MAX_PAGE_SIZE),
        sort_by=sort_by,
        sort_order=sort_order,
    )
```

### 2.3 Get Doctor

```python
def get_doctor(self, doctor_id: UUID) -> Doctor:
    """Get doctor by ID with relationships loaded."""
    doctor = self.doctor_repo.get_by_id(doctor_id)
    if not doctor:
        raise DoctorNotFound(doctor_id)
    return doctor
```

### 2.4 Update Doctor

```python
def update_doctor(self, doctor_id: UUID, payload: DoctorUpdate, updated_by: int) -> Doctor:
    """Update doctor profile fields. Only provided fields are updated."""
    try:
        doctor = self.get_doctor(doctor_id)

        updates = payload.model_dump(exclude_unset=True, exclude_none=True)
        if not updates:
            return doctor

        doctor = self.doctor_repo.update(doctor, updates, updated_by)
        self.db.commit()
        self.db.refresh(doctor)
        return doctor

    except Exception:
        self.db.rollback()
        logger.exception("Failed to update doctor id=%s", doctor_id)
        raise DoctorUpdateFailed(doctor_id)
```

### 2.5 Status Methods

```python
def change_status(self, doctor_id: UUID, is_active: bool, updated_by: int) -> Doctor:
    """Activate or deactivate a doctor profile."""
    doctor = self.get_doctor(doctor_id)
    if doctor.is_active == is_active:
        state = "active" if is_active else "inactive"
        raise InvalidDoctorOperation(f"Doctor is already {state}")

    doctor = self.doctor_repo.set_active_status(doctor_id, is_active, updated_by)
    self.db.commit()
    logger.info("Doctor %s: id=%s by user_id=%d",
                "activated" if is_active else "deactivated", doctor_id, updated_by)
    return doctor

def toggle_availability(self, doctor_id: UUID, available: bool) -> Doctor:
    """Toggle the available_for_appointment flag.
    Raises InvalidDoctorOperation if the doctor is inactive (INV-11).
    """
    doctor = self.get_doctor(doctor_id)
    if available and not doctor.is_active:
        raise InvalidDoctorOperation("Inactive doctors cannot set available_for_appointment=true")
    doctor = self.doctor_repo.toggle_availability(doctor_id, available)
    self.db.commit()
    return doctor

def toggle_leave(self, doctor_id: UUID, on_leave: bool) -> Doctor:
    """Toggle the on_leave flag."""
    doctor = self.get_doctor(doctor_id)
    doctor = self.doctor_repo.toggle_leave(doctor_id, on_leave)
    self.db.commit()
    return doctor

def check_availability(self, doctor_id: UUID) -> dict:
    """Check computed availability status (respects INV-11 and INV-12)."""
    doctor = self.get_doctor(doctor_id)
    return {
        "id": doctor.id,
        "is_active": doctor.is_active,
        "available_for_appointment": doctor.available_for_appointment,
        "on_leave": doctor.on_leave,
        "available": doctor.is_active and doctor.available_for_appointment and not doctor.on_leave,
    }
```

### 2.6 Specialization Management

```python
def list_active_specializations(self) -> list[Specialization]:
    """List all active specializations."""
    return self.specialization_repo.list_active()


def assign_specialization(self, doctor_id: UUID, payload: DoctorSpecializationAssign) -> DoctorSpecialization:
    """Assign a specialization to a doctor."""
    doctor = self.get_doctor(doctor_id)
    specialization = self.specialization_repo.get_by_id(payload.specialization_id)
    if not specialization:
        raise SpecializationNotFound(payload.specialization_id)

    if payload.is_primary:
        return self.ds_repo.add(
            doctor_id=doctor_id,
            specialization_id=payload.specialization_id,
            is_primary=True,
            certification_date=payload.certification_date,
        )
    else:
        return self.ds_repo.add(
            doctor_id=doctor_id,
            specialization_id=payload.specialization_id,
            is_primary=False,
            certification_date=payload.certification_date,
        )

def remove_specialization(self, doctor_id: UUID, specialization_id: int) -> None:
    """Remove a specialization from a doctor."""
    doctor = self.get_doctor(doctor_id)
    removed = self.ds_repo.remove(doctor_id, specialization_id)
    if not removed:
        raise SpecializationNotFound(specialization_id)

    # If removed primary, ensure another exists
    remaining = self.ds_repo.get_by_doctor(doctor_id)
    if remaining and not any(ds.is_primary for ds in remaining):
        # Auto-set first remaining as primary
        self.ds_repo.set_primary(doctor_id, remaining[0].specialization_id)

def set_primary_specialization(self, doctor_id: UUID, specialization_id: int) -> None:
    """Set a specialization as the primary."""
    self.get_doctor(doctor_id)
    self.ds_repo.set_primary(doctor_id, specialization_id)
```

### 2.7 Schedule Management

```python
def create_schedule(self, doctor_id: UUID, payload: ScheduleCreate) -> DoctorSchedule:
    """Create a schedule entry with overlap detection."""
    doctor = self.get_doctor(doctor_id)

    if self.schedule_repo.has_overlap(
        doctor_id, payload.day_of_week, payload.start_time, payload.end_time
    ):
        raise ScheduleOverlap(doctor_id, payload.day_of_week)

    schedule = self.schedule_repo.create(doctor_id, payload.model_dump())
    self.db.commit()
    return schedule

def update_schedule(self, schedule_id: UUID, payload: ScheduleUpdate, doctor_id: UUID) -> DoctorSchedule:
    """Update a schedule entry with overlap detection."""
    schedule = self.schedule_repo.get_by_id(schedule_id)
    if not schedule:
        raise ScheduleNotFound(schedule_id)

    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not updates:
        return schedule

    # Check overlap if time/day changed
    day = updates.get("day_of_week", schedule.day_of_week)
    start = updates.get("start_time", schedule.start_time)
    end = updates.get("end_time", schedule.end_time)
    if self.schedule_repo.has_overlap(doctor_id, day, start, end, exclude_id=schedule_id):
        raise ScheduleOverlap(doctor_id, day)

    schedule = self.schedule_repo.update(schedule_id, updates)
    self.db.commit()
    return schedule

def delete_schedule(self, schedule_id: UUID) -> None:
    """Delete a schedule entry."""
    if not self.schedule_repo.delete(schedule_id):
        raise ScheduleNotFound(schedule_id)
    self.db.commit()
```

---

## 3. Service Methods Excluded from MVP

| Method | Feature | Future Phase |
|---|---|---|
| `add_credential` | Credential management | Phase 18 |
| `check_credential_expiry` | License expiry alerts | Phase 18 |
| `request_leave` | Leave management | Phase 18 |
| `approve_leave` | Leave approval workflow | Phase 18 |
| `set_commission_rate` | Commission configuration | Phase 18 |
| `get_performance_metrics` | Performance analytics | Phase 18 |
| `get_revenue_analytics` | Revenue analytics | Phase 18 |

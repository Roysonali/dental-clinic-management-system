# Phase 11: Repository Layer — Doctor Management Module

> **Status:** PASS | **Target Quality Score:** 9.8/10
> **MVP Scope:** Only repository methods for Doctor Profile, Specialization, and Schedule management.

---

## 1. Design Patterns

Following `patients/repository.py` and `appointments/repository.py`:

- Stateless repository class with `Session` dependency
- Explicit method signatures (no generic `**kwargs`)
- Methods return ORM model instances
- Query construction uses SQLAlchemy ORM
- Pagination using `.offset()` / `.limit()` with total count
- Search using `ILIKE` for case-insensitive matching
- No business logic — pure data access

---

## 2. DoctorRepository

```python
class DoctorRepository:
    def __init__(self, db: Session):
        self.db = db
```

### 2.1 CRUD Methods

| Method | Signature | Description |
|---|---|---|
| `create` | `(doctor: Doctor) -> Doctor` | Persist new doctor, refresh, return |
| `get_by_id` | `(doctor_id: UUID) -> Optional[Doctor]` | Single doctor by ID with eager-loaded relationships (specializations, schedules) via `selectinload()` using `.options(selectinload(Doctor.specializations), selectinload(Doctor.schedules))` |
| `get_by_user_id` | `(user_id: int) -> Optional[Doctor]` | Find doctor by linked user |
| `get_by_doctor_code` | `(code: str) -> Optional[Doctor]` | Find by unique doctor code |
| `update` | `(doctor: Doctor, updates: dict, updated_by: int) -> Doctor` | Apply field-level updates |
| `delete` | `(doctor: Doctor) -> None` | Hard delete (admin only, rare) |

### 2.2 List/Search Method

```python
def list(
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
```

**Query construction:**

```python
def list(self, search=None, specialization_id=None, is_active=None,
         available=None, page=1, page_size=20,
         sort_by="full_name", sort_order="asc"):

    query = self.db.query(Doctor).join(User).outerjoin(DoctorSpecialization)

    # Search filter (names are on User, doctor_code on Doctor)
    if search:
        search_filter = (
            User.full_name.ilike(f"%{search}%") |
            Doctor.doctor_code.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)

    # Specialization filter
    if specialization_id:
        query = query.filter(
            DoctorSpecialization.specialization_id == specialization_id,
            Doctor.id == DoctorSpecialization.doctor_id,
        )

    # Status filters
    if is_active is not None:
        query = query.filter(Doctor.is_active == is_active)
    if available is not None:
        query = query.filter(
            Doctor.available_for_appointment == available,
            Doctor.on_leave == False,
        )

    # Deduplicate (from outerjoin)
    query = query.distinct()

    # Total count
    total = query.count()

    # Sorting (full_name resolved through User join)
    if sort_by == "full_name":
        sort_column = User.full_name
    else:
        sort_column = getattr(Doctor, sort_by, User.full_name)
    sort_fn = sort_column.asc if sort_order == "asc" else sort_column.desc
    query = query.order_by(sort_fn())

    # Pagination
    doctors = query.offset((page - 1) * page_size).limit(page_size).all()

    return doctors, total
```

### 2.3 Status Methods

```python
def set_active_status(self, doctor_id: UUID, is_active: bool, updated_by: int) -> Doctor:
    doctor = self.get_by_id(doctor_id)
    if doctor:
        doctor.is_active = is_active
        doctor.updated_by = updated_by
        doctor.updated_at = func.now()
        self.db.flush()
    return doctor

def toggle_availability(self, doctor_id: UUID, available: bool) -> Doctor:
    doctor = self.get_by_id(doctor_id)
    if doctor:
        doctor.available_for_appointment = available
        self.db.flush()
    return doctor

def toggle_leave(self, doctor_id: UUID, on_leave: bool) -> Doctor:
    doctor = self.get_by_id(doctor_id)
    if doctor:
        doctor.on_leave = on_leave
        self.db.flush()
    return doctor
```

### 2.4 Doctor Code Generation

```python
def get_next_doctor_code_sequence(self) -> int:
    """Get next sequence number for doctor code generation."""
    result = self.db.query(func.max(Doctor.doctor_code)).scalar()
    if result is None:
        return 1
    # Extract numeric portion: DOC-00001 -> 1
    match = re.search(r"(\d+)$", result)
    return int(match.group(1)) + 1 if match else 1
```

---

## 3. SpecializationRepository

```python
class SpecializationRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, specialization: Specialization) -> Specialization:
        self.db.add(specialization)
        self.db.flush()
        return specialization

    def get_by_id(self, specialization_id: int) -> Optional[Specialization]:
        return self.db.query(Specialization).filter(
            Specialization.id == specialization_id
        ).first()

    def get_by_name(self, name: str) -> Optional[Specialization]:
        return self.db.query(Specialization).filter(
            Specialization.name == name
        ).first()

    def list_active(self) -> list[Specialization]:
        return self.db.query(Specialization).filter(
            Specialization.is_active == True
        ).order_by(Specialization.name).all()

    def list_all(self) -> list[Specialization]:
        return self.db.query(Specialization).order_by(Specialization.name).all()
```

---

## 4. DoctorSpecializationRepository

```python
class DoctorSpecializationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_doctor(self, doctor_id: UUID) -> list[DoctorSpecialization]:
        return self.db.query(DoctorSpecialization).filter(
            DoctorSpecialization.doctor_id == doctor_id
        ).all()

    def add(self, doctor_id: UUID, specialization_id: int,
            is_primary: bool = False, certification_date: date | None = None
            ) -> DoctorSpecialization:
        ds = DoctorSpecialization(
            doctor_id=doctor_id,
            specialization_id=specialization_id,
            is_primary=is_primary,
            certification_date=certification_date,
        )
        self.db.add(ds)
        self.db.flush()
        return ds

    def remove(self, doctor_id: UUID, specialization_id: int) -> bool:
        rows = self.db.query(DoctorSpecialization).filter(
            DoctorSpecialization.doctor_id == doctor_id,
            DoctorSpecialization.specialization_id == specialization_id,
        ).delete()
        return rows > 0

    def set_primary(self, doctor_id: UUID, specialization_id: int) -> None:
        # Clear existing primary
        self.db.query(DoctorSpecialization).filter(
            DoctorSpecialization.doctor_id == doctor_id,
            DoctorSpecialization.is_primary == True,
        ).update({"is_primary": False})
        # Set new primary
        self.db.query(DoctorSpecialization).filter(
            DoctorSpecialization.doctor_id == doctor_id,
            DoctorSpecialization.specialization_id == specialization_id,
        ).update({"is_primary": True})
        self.db.flush()

    def get_primary(self, doctor_id: UUID) -> Optional[DoctorSpecialization]:
        return self.db.query(DoctorSpecialization).filter(
            DoctorSpecialization.doctor_id == doctor_id,
            DoctorSpecialization.is_primary == True,
        ).first()
```

---

## 5. DoctorScheduleRepository

```python
class DoctorScheduleRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_doctor(self, doctor_id: UUID) -> list[DoctorSchedule]:
        return self.db.query(DoctorSchedule).filter(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.is_active == True,
        ).order_by(DoctorSchedule.day_of_week, DoctorSchedule.start_time).all()

    def get_by_id(self, schedule_id: UUID) -> Optional[DoctorSchedule]:
        return self.db.query(DoctorSchedule).filter(
            DoctorSchedule.id == schedule_id
        ).first()

    def create(self, doctor_id: UUID, data: dict) -> DoctorSchedule:
        schedule = DoctorSchedule(doctor_id=doctor_id, **data)
        self.db.add(schedule)
        self.db.flush()
        return schedule

    def update(self, schedule_id: UUID, data: dict) -> Optional[DoctorSchedule]:
        schedule = self.get_by_id(schedule_id)
        if schedule:
            for key, value in data.items():
                setattr(schedule, key, value)
            self.db.flush()
        return schedule

    def delete(self, schedule_id: UUID) -> bool:
        rows = self.db.query(DoctorSchedule).filter(
            DoctorSchedule.id == schedule_id
        ).delete()
        return rows > 0

    def has_overlap(self, doctor_id: UUID, day_of_week: int,
                    start_time: time, end_time: time,
                    exclude_id: UUID | None = None) -> bool:
        query = self.db.query(DoctorSchedule).filter(
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.day_of_week == day_of_week,
            DoctorSchedule.is_active == True,
            DoctorSchedule.start_time < end_time,
            DoctorSchedule.end_time > start_time,
        )
        if exclude_id:
            query = query.filter(DoctorSchedule.id != exclude_id)
        return query.first() is not None
```

---

## 6. Repository Methods Excluded from MVP

| Method | Feature | Future Phase |
|---|---|---|
| `CredentialRepository.*` | Credential management | Phase 18 |
| `LeaveRecordRepository.*` | Leave management | Phase 18 |
| `CommissionRateRepository.*` | Commission configuration | Phase 18 |
| `PerformanceMetricRepository.*` | Performance analytics | Phase 18 |

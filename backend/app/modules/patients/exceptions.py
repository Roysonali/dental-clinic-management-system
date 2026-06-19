from typing import Any


class PatientException(
    Exception,
):

    def __init__(
        self,
        code: str,
        message: str,
        details: Any = None,
    ):

        self.code = code

        self.message = message

        self.details = details

        super().__init__(
            message
        )

    def to_dict(
        self,
    ) -> dict:

        return {

            "error": {

                "code": self.code,

                "message": self.message,

                "details": self.details,
            }
        }



class PatientNotFound(
    PatientException
):

    def __init__(
        self,
    ):

        super().__init__(

            code="PATIENT_NOT_FOUND",

            message="Patient does not exist",
        )



class DuplicatePatientDetected(
    PatientException
):

    def __init__(
        self,
        details=None,
    ):

        super().__init__(

            code="DUPLICATE_PATIENT",

            message=(
                "Possible duplicate patient detected"
            ),

            details=details,
        )



class PatientInactive(
    PatientException
):

    def __init__(
        self,
    ):

        super().__init__(

            code="PATIENT_INACTIVE",

            message=(
                "Patient is inactive"
            ),
        )



class PatientValidationFailed(
    PatientException
):

    def __init__(
        self,
        details=None,
    ):

        super().__init__(

            code="PATIENT_VALIDATION_FAILED",

            message=(
                "Patient validation failed"
            ),

            details=details,
        )



class PatientCreationFailed(
    PatientException
):

    def __init__(
        self,
        details=None,
    ):

        super().__init__(

            code="PATIENT_CREATION_FAILED",

            message=(
                "Patient creation failed"
            ),

            details=details,
        )



class PatientUpdateFailed(
    PatientException
):

    def __init__(
        self,
        details=None,
    ):

        super().__init__(

            code="PATIENT_UPDATE_FAILED",

            message=(
                "Patient update failed"
            ),

            details=details,
        )



class InvalidPatientOperation(
    PatientException
):

    def __init__(
        self,
        details=None,
    ):

        super().__init__(

            code="INVALID_PATIENT_OPERATION",

            message=(
                "Invalid patient operation"
            ),

            details=details,
        )